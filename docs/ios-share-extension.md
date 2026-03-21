# iOS Share Extension For EveryYou

Это следующий нативный шаг после текущего Expo-клиента.

Что уже подготовлено в приложении:

- у mobile-приложения есть схема `everyyou://`
- app умеет принимать входящие deeplink-ссылки
- если передать Spotify URL, приложение откроет экран `добавить` и подставит ссылку в импорт
- если передать `everyyou://import?type=book&title=...&author=...`, приложение откроет ручное добавление

## Что это даст пользователю

Share Extension нужен, чтобы в iPhone можно было:

- нажать `Поделиться` из Safari
- нажать `Поделиться` из Фото
- нажать `Поделиться` из Файлов
- выбрать `EveryYou`
- и сразу отправить ссылку, файл или изображение в приложение

## Ограничение

Это уже не `Expo Go`.

Для настоящего Share Extension нужен:

- development build
- prebuild / ios native project
- отдельный iOS extension target

## Какой поток я рекомендую

### 1. Ссылки

Самый простой первый вариант:

- Share Extension получает URL
- делает redirect в `everyyou://import?url=...`
- приложение открывает экран `добавить`
- если это Spotify URL, он сразу попадает в Spotify import

### 2. Картинки

Следующий слой:

- Share Extension получает изображение
- сохраняет его во shared container
- открывает `everyyou://import-image?...`
- основное приложение читает файл и запускает тот же AI import, что уже есть сейчас

### 3. CSV / файлы

Еще один слой:

- Share Extension принимает CSV или text file
- сохраняет во shared container
- открывает `everyyou://import-file?...`
- основное приложение забирает файл и отправляет его в существующий file import flow

## Что сделать технически

### Expo / native

1. В `apps/mobile` сделать `npx expo prebuild --platform ios`
2. Открыть `ios/*.xcworkspace`
3. Добавить новый target:
   - `Share Extension`
4. Настроить App Group, если хотим передавать файлы и изображения через shared container
5. Добавить deeplink open в основное приложение через `everyyou://...`

### EveryYou app

В самом приложении логика уже частично готова:

- custom scheme: `everyyou`
- intake ссылок через `Linking`

Следующий кодовый шаг после создания extension target:

- добавить разбор `everyyou://import-file`
- добавить разбор `everyyou://import-image`
- забирать payload из shared container

## Самый полезный MVP

Если делать по приоритету, то вот так:

1. Share URL from Safari / Notes / Telegram / browser
2. Share image from Photos
3. Share file from Files / iCloud Drive

Именно этот порядок даст самый быстрый вау-эффект.
