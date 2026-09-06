"""
python ~/.claude/complexity.py [path ...]
python ~/.claude/complexity.py --limit 20 --top 40 src apps
python ~/.claude/complexity.py --all .
"""

import argparse
import ast
import pathlib
import re
import sys

BRACE_SUFFIXES = {'.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx', '.cppm', '.ixx',
                  '.cs', '.java', '.js', '.jsx', '.ts', '.tsx', '.go', '.rs'}
PYTHON_SUFFIXES = {'.py', '.pyi'}
SKIP_DIRECTORIES = {'.git', '.vs', '.venv', 'build', 'out', 'dist', 'target', 'node_modules',
                    'vcpkg_installed', '__pycache__', 'CMakeFiles'}

DECISION = re.compile(r'\b(if|for|while|case|catch)\b|&&|\|\||\?')
BLOCK_KEYWORD = re.compile(r'^\s*(namespace|struct|class|enum|union|extern|interface|module)\b')
NOT_A_CALL = {'if', 'for', 'while', 'switch', 'catch', 'return', 'sizeof', 'decltype', 'noexcept',
              'requires', 'static_assert', 'throw', 'new', 'delete', 'using', 'operator'}
BACKSLASH = chr(92)


def without_noise(text):
    kept, index, length = [], 0, len(text)
    while index < length:
        character = text[index]
        pair = text[index:index + 2]
        raw = re.match(r'R"([^("]{0,16})\(', text[index:])
        if pair == '//':
            newline = text.find('\n', index)
            index = length if newline < 0 else newline
        elif pair == '/*':
            closing = text.find('*/', index + 2)
            kept.append(' ')
            index = length if closing < 0 else closing + 2
        elif character == 'R' and raw:
            terminator = ')' + raw.group(1) + '"'
            closing = text.find(terminator, index + len(raw.group(0)))
            kept.append('""')
            index = length if closing < 0 else closing + len(terminator)
        elif character == '"' or character == "'":
            quote, index = character, index + 1
            while index < length and text[index] != quote:
                index += 2 if text[index] == BACKSLASH else 1
            index += 1
            kept.append('""')
        elif character == '#' and (not kept or kept[-1] == '\n'):
            while index < length:
                newline = text.find('\n', index)
                if newline < 0:
                    index = length
                    break
                index = newline
                if text[max(newline - 1, 0)] != BACKSLASH:
                    break
                index += 1
        else:
            kept.append(character)
            index += 1
    return ''.join(kept)


def is_definition(signature):
    if '(' not in signature or ')' not in signature:
        return False
    close = signature.rindex(')')
    depth, opening = 0, -1
    for position in range(close, -1, -1):
        if signature[position] == ')':
            depth += 1
        elif signature[position] == '(':
            depth -= 1
            if depth == 0:
                opening = position
                break
    if opening <= 0:
        return False
    if re.search(r'[^\s\w:>&*\]),]', signature[close + 1:]):
        return False
    called = re.search(r'([A-Za-z_~][A-Za-z_0-9]*)\s*$', signature[:opening])
    if not called or called.group(1) in NOT_A_CALL:
        return False
    return not BLOCK_KEYWORD.match(signature.strip().split('\n')[-1])


def brace_functions(source):
    text = without_noise(source)
    line_at, line = [1] * (len(text) + 1), 1
    for position, character in enumerate(text):
        line_at[position] = line
        if character == '\n':
            line += 1
    found, position, length, signature_from = [], 0, len(text), 0
    while position < length:
        character = text[position]
        if character == '{':
            signature = text[signature_from:position]
            if is_definition(signature):
                cursor, depth = position, 0
                while cursor < length:
                    if text[cursor] == '{':
                        depth += 1
                    elif text[cursor] == '}':
                        depth -= 1
                        if depth == 0:
                            break
                    cursor += 1
                body = text[position:cursor + 1]
                name = re.sub(r'\s+', ' ', signature.strip().split('\n')[-1]).strip()
                found.append((1 + len(DECISION.findall(body)), line_at[position],
                              name[-90:], body.count('\n') + 1))
                position, signature_from = cursor + 1, cursor + 1
                continue
            signature_from = position + 1
        elif character == '}' or character == ';':
            signature_from = position + 1
        position += 1
    return found


class PythonWalker(ast.NodeVisitor):
    def __init__(self):
        self.score = 1

    def visit_If(self, node):
        self.score += 1
        self.generic_visit(node)

    visit_IfExp = visit_If

    def visit_For(self, node):
        self.score += 1
        self.generic_visit(node)

    visit_AsyncFor = visit_For
    visit_While = visit_For

    def visit_ExceptHandler(self, node):
        self.score += 1
        self.generic_visit(node)

    visit_Assert = visit_ExceptHandler

    def visit_BoolOp(self, node):
        self.score += len(node.values) - 1
        self.generic_visit(node)

    def visit_match_case(self, node):
        self.score += 1
        self.generic_visit(node)

    def visit_comprehension(self, node):
        self.score += 1 + len(node.ifs)
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        pass

    visit_AsyncFunctionDef = visit_FunctionDef
    visit_Lambda = visit_FunctionDef


def python_functions(source):
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    found = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        walker = PythonWalker()
        for child in node.body:
            walker.visit(child)
        span = (node.end_lineno or node.lineno) - node.lineno + 1
        found.append((walker.score, node.lineno, node.name, span))
    return found


def measure(path):
    source = path.read_text(encoding='utf-8', errors='replace')
    if path.suffix in PYTHON_SUFFIXES:
        return python_functions(source)
    return brace_functions(source)


def sources(roots):
    for root in roots:
        start = pathlib.Path(root)
        candidates = [start] if start.is_file() else sorted(start.rglob('*'))
        for path in candidates:
            if not path.is_file():
                continue
            if set(path.parts) & SKIP_DIRECTORIES:
                continue
            if path.suffix in BRACE_SUFFIXES or path.suffix in PYTHON_SUFFIXES:
                yield path


def main():
    parser = argparse.ArgumentParser(description='Report cyclomatic complexity per function.')
    parser.add_argument('roots', nargs='*', default=['.'])
    parser.add_argument('--limit', type=int, default=20)
    parser.add_argument('--top', type=int, default=0)
    parser.add_argument('--all', action='store_true')
    options = parser.parse_args()

    rows = []
    for path in sources(options.roots or ['.']):
        for score, line, name, span in measure(path):
            if options.all or score >= options.limit:
                rows.append((score, f'{path.as_posix()}:{line}', name, span))
    rows.sort(reverse=True)

    shown = rows[:options.top] if options.top else rows
    for score, where, name, span in shown:
        print(f'{score:4}  {span:5} lines  {where}  {name}')

    over = sum(1 for row in rows if row[0] >= options.limit)
    if options.top and len(rows) > len(shown):
        print(f'\n... {len(rows) - len(shown)} more not shown')
    print(f'\n{over} functions at or over {options.limit}')
    return 1 if over else 0


if __name__ == '__main__':
    sys.exit(main())
