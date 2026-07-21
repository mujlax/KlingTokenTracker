export const VERSION = '0.9.6';
export const VERSION_HISTORY = [
    {
        version: '0.9.6',
        date: '2026-07-21',
        changes: [
            'Создание нового проекта прямо во время отмены траты',
            'Автозаполнение названия проекта из поискового запроса',
            'Новый проект сразу привязывается к трате и становится активным'
        ]
    },
    {
        version: '0.9.5',
        date: '2026-07-20',
        changes: [
            'Обновлена пересборка dist для Tampermonkey',
            'Синхронизирована версия во всех артефактах проекта'
        ]
    },
    {
        version: '0.9.4',
        date: '2026-07-20',
        changes: [
            'Полный перевод интерфейса панели на русский язык',
            'Русские сообщения об ошибках синхронизации Google Sheets',
            'Обновлено описание userscript для Tampermonkey'
        ]
    },
    {
        version: '0.9.3',
        date: '2026-07-20',
        changes: [
            'Добавлен поиск проектов по имени в отмене',
            'Сортировка проектов в отмене по дате создания (новые первыми)',
            'Быстрый поиск проектов в компактной панели'
        ]
    },
    {
        version: '0.9.2',
        date: '2026-07-20',
        changes: [
            'Смена проекта при отмене траты',
            'Пауза таймеров отмены и Sheets при выборе проекта',
            'Обновление проекта синхронизированных событий'
        ]
    },
    {
        version: '0.9.1',
        date: '2026-07-17',
        changes: [
            'Обновлён URL веб-приложения Google Sheets по умолчанию',
            'Автомиграция устаревших URL синхронизации из кэша'
        ]
    },
    {
        version: '0.9.0',
        date: '2026-07-17',
        changes: [
            'Общий каталог проектов в Google Sheets',
            'Умные подсказки дубликатов при создании проектов',
            'Безопасное архивирование общих проектов'
        ]
    },
    {
        version: '0.8.8',
        date: '2026-07-06',
        changes: [
            'Синхронизация pull из Google Sheets',
            'Упрощены столбцы Sheets до необходимого минимума',
            'Автор траты отображается в истории'
        ]
    },
    {
        version: '0.8.7',
        date: '2026-07-06',
        changes: [
            'Уведомление об отмене в заголовке панели',
            'Замена заголовка при активной отмене',
            'Подсветка времени трат'
        ]
    },
    {
        version: '0.8.6',
        date: '2026-07-06',
        changes: [
            'Исправлен масштаб баланса Kling',
            'Нормализация кредитов point/ticket',
            'Добавлено регрессионное покрытие'
        ]
    },
    {
        version: '0.8.5',
        date: '2026-07-06',
        changes: [
            'Удаление трат из истории',
            '10-секундная отмена недавних трат',
            'Отложенная синхронизация Sheets с поддержкой удаления'
        ]
    },
    {
        version: '0.8.4',
        date: '2026-07-06',
        changes: [
            'Сокращён заголовок панели до AITT',
            'Кликабельный значок версии',
            'Changelog в настройках'
        ]
    },
    {
        version: '0.8.3',
        date: '2026-07-06',
        changes: [
            'Поддержка SJinn Seedance',
            'Расчёт трат Seedance по выбранным настройкам',
            'Адаптеры перенесены в фабричный список'
        ]
    }
];

export const UI_CLICK_DEDUP_MS = 3000;
export const SPEND_UNDO_WINDOW_MS = 10000;
export const SHEETS_SYNC_DELAY_MS = 10000;
export const SHEETS_PULL_INTERVAL_MS = 60000;
export const SPEND_MERGE_MS = 8000;
export const STORAGE_PREFIX = 'klingTokenTracker.';
export const HISTORY_KEY = STORAGE_PREFIX + 'history.v1';
export const SESSION_KEY = STORAGE_PREFIX + 'session.v1';
export const META_KEY = STORAGE_PREFIX + 'meta.v1';
export const DEBUG_KEY = STORAGE_PREFIX + 'debug.v1';
export const PANEL_KEY = STORAGE_PREFIX + 'panel.v1';
export const UI_KEY = STORAGE_PREFIX + 'ui.v1';
export const SETTINGS_KEY = STORAGE_PREFIX + 'settings.v1';
export const SHEETS_SYNC_KEY = STORAGE_PREFIX + 'sheetsSync.v1';
export const PROJECTS_SYNC_KEY = STORAGE_PREFIX + 'projectsSync.v1';
export const DEFAULT_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz9bp6ZWtJD5jJYdYPi-rjLkJO71L2dMJL8hxmayfuKtImtd_qbnVfTP25saOL0hlCj_Q/exec';
// Previously shipped default web app URLs. If a user has one of these cached,
// force-migrate them to the current DEFAULT_SHEETS_WEB_APP_URL on load.
export const LEGACY_SHEETS_WEB_APP_URLS = [
    'https://script.google.com/macros/s/AKfycbyBKgzw0oZmfdaOSHU4iBdsRY6l-tXupdUNjcRbMDNw7-glxMuw9kC2rJCljgJquDZORA/exec',
    'https://script.google.com/macros/s/AKfycbxi3YrJYesMvttSYoFVA-_E_RxIeSHXIOjmGvFVc4HVmOp0QDka_rUo2Oxw82fTP2HXmg/exec',
    'https://script.google.com/macros/s/AKfycbwZ4SqCwMEvByu8L1MNO1OdRz30Q96HDGabFl5nj_ZvoT2Lw1Z9iWLH5vvswalTwV90kg/exec',
    'https://script.google.com/macros/s/AKfycbwG2o3NIhF6zUURKV_0G0YBRm3nYIPHfbnLKIf4kuOQb2NuGljoqAD8AbG5blBRUAXc5g/exec',
    'https://script.google.com/macros/s/AKfycbzYAcB-tOiiNjUs9_wNM2VbIYqobqn9BMGJSuQzXTzZgwsp9-gRNYOdlpTF8JhabtTPfg/exec'
];
export const DEFAULT_SHEETS_SECRET_TOKEN = 'token';
export const PROJECT_KEY = STORAGE_PREFIX + 'project.v1';
export const PROJECTS_LIBRARY_KEY = STORAGE_PREFIX + 'projects.v1';
export const MAX_PROJECTS = 100;
export const MAX_EVENTS = 200;
export const DUPLICATE_WINDOW_MS = 45 * 1000;
export const UI_SCAN_DEBOUNCE_MS = 450;
export const UI_SCAN_INTERVAL_MS = 3000;
export const MIN_BALANCE_SCORE = 14;
export const MIN_UI_SCORE = 14;
