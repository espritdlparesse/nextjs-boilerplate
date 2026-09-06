# Вайбчек

Короткая прожарка по библиотеке. Роут `app/api/v2/analysis/route.ts`, окно функции 60 секунд.

## Ход одного запроса

```mermaid
flowchart TD
    START([POST /api/v2/analysis]) --> AUTH[resolveApiIdentity<br/>getEffectiveOwner]
    AUTH --> LOAD[(items<br/>до 300, с диапазоном до 1000)]
    LOAD --> EMPTY{библиотека пуста?}
    EMPTY -->|да| STUB[заглушка «нечего анализировать»]
    EMPTY -->|нет| SAMPLE

    SAMPLE[buildVibeSample<br/>до 32 позиций, не более 8 на тип<br/>сид — сегодняшняя дата]
    SAMPLE --> CTX[(cultural_context<br/>карточки к позициям)]
    CTX --> BAD[(vibe_feedback<br/>5 последних «плохо»)]
    BAD --> PROMPT[planningPrompt:<br/>строки библиотеки + фактура под каждой<br/>+ забракованные формулировки]

    PROMPT --> PLAN[["вызов 1 — планировщик<br/>3 кандидата: basis, types, observation"]]
    PLAN --> VALID{валидных<br/>кандидатов}
    VALID -->|0| ONE[редактор выбирает пару сам]
    VALID -->|1+| DUEL{дуэль?}

    DUEL -->|нет| ONE
    DUEL -->|да| TWO[два разных кандидата]

    ONE --> WRITE
    TWO --> WRITE
    WRITE[["вызов 2 — редактор<br/>параллельно на каждый вариант<br/>пара + её фактура + наблюдение"]]

    WRITE --> GATE{blockingGates}
    GATE -->|не прошёл| RETRY[["ремонтный повтор, один раз"]]
    RETRY --> GATE2{blockingGates}
    GATE2 -->|не прошёл| REJ[422 «не нашёл точную пару»]
    GATE2 -->|прошёл| OK
    GATE -->|прошёл| OK[normalizeRoastNames]

    OK --> SAVE[(vibe_runs)]
    REJ --> SAVE
    SAVE --> RESP([ответ: summary, basis, runId])

    PLAN -.ошибка OpenAI.-> FB[generateFallbackVibecheck<br/>без ИИ, заготовленные фразы]
    WRITE -.ошибка OpenAI.-> FB
    FB --> SAVE
```

Условие дуэли: заголовок `x-vibecheck-duel: 1`, `VIBECHECK_DUEL_EVERY` больше нуля, не менее двух валидных кандидатов, и число доставленных прогонов владельца кратно N. По умолчанию N = 5.

## Источники данных

```mermaid
flowchart LR
    subgraph IN["читает"]
        ITEMS[(items<br/>библиотека)]
        CARDS[(cultural_context<br/>431 карточка)]
        FEED[(vibe_feedback<br/>оценки «плохо»)]
        RUNS_R[(vibe_runs<br/>счётчик для дуэли)]
    end

    ENGINE{{вайбчек}}
    OPENAI[["OpenAI<br/>gpt-4.1, два вызова"]]

    subgraph OUT["пишет"]
        RUNS_W[(vibe_runs<br/>прогон, включая отказы)]
        DUELS[(vibe_duels<br/>пара и выбор)]
        FEED_W[(vibe_feedback<br/>оценка с run_id)]
        EVENTS[(app_events<br/>шеринг, перезапуск)]
        FORMS[(vibe_forms<br/>метки формы)]
    end

    ITEMS --> ENGINE
    CARDS --> ENGINE
    FEED --> ENGINE
    RUNS_R --> ENGINE
    ENGINE <--> OPENAI
    ENGINE --> RUNS_W
    ENGINE --> DUELS
    RUNS_W -.человек оценил.-> FEED_W
    RUNS_W -.человек поделился или перезапустил.-> EVENTS
    RUNS_W -.классификатор, отдельно.-> FORMS
    FEED_W -.5 последних «плохо».-> FEED
```

## Что откуда берётся

| Источник | Как попадает в промпт | Ограничение |
|---|---|---|
| `items` | до 32 позиций выборки | не более 8 на тип, дубли по автору отбрасываются |
| `cultural_context` | фактура под каждой позицией и под выбранной парой | запрос тянет до 400 карточек, совпадение по ключу и алиасам |
| `vibe_feedback` | блок «уже забраковал эти формулировки» | 5 последних с оценкой «плохо», только свои |

Карточку нельзя пересказывать и нельзя называть источник — она опора для наблюдения, а не содержание.

## Фильтры

```mermaid
flowchart LR
    TEXT[текст вайбчека] --> B{blockingGates}
    B --> C1[looksTooComplicated<br/>длинные фразы, «как будто»]
    B --> C2[looksTooGenericRoast<br/>около 45 запрещённых формул]
    TEXT --> O{observedGates}
    O --> C3[looksTooCorporate]
    O --> C4[looksTooAbstract]
    O --> C5[looksTooSoft]

    C1 --> STOP[повтор, затем 422]
    C2 --> STOP
    C3 --> MARK[метка в gate_hits<br/>отказа не вызывает]
    C4 --> MARK
    C5 --> MARK
```

Наблюдающие фильтры сняты с боевого пути 2026-08-31 в коммите `1d39166`. Они возвращены только как счётчики: `looksTooSoft` запрещает слово «кажется», с которого начинается образцовый вайбчек в самой инструкции редактора.

## Наполнение карточек

Отдельный процесс, в тракте запроса не участвует.

```mermaid
flowchart LR
    RUN[npm run warm-context] --> DIFF[имена из items<br/>минус уже известные]
    DIFF --> SEARCH[["модель с вебпоиском<br/>партии по 8"]]
    SEARCH --> HOSTS{домен в списке?}
    HOSTS -->|нет| DROP[отброшено]
    HOSTS -->|да| SAVE[(cultural_context)]
```

Разрешённые издания: The Atlantic, New Yorker, NYT, «Медуза», The Bell, Кинопоиск, WOS, архив «Афиши» до 2021 года, X и Facebook Ильи Красильщика, Wonderzine. Для «Афиши» проверяется ещё и дата публикации.

Замер на 2026-09-06: из 431 карточки 288 годны, 143 нет — 103 пустой похвалы, 42 новостных повода, 13 канцелярита. Фильтра на входе пока нет.

## Что собирается для будущего

`vibe_runs` пишется на каждом выходе, включая 422 и фоллбэк: выбранная пара, наблюдение планировщика, состав типов, сработавшие фильтры, число повторов, версия промпта, признак контрольной группы.

Ничего из этого сейчас на вайбчек не влияет. Это материал для следующего шага — см. план петли обратной связи.
