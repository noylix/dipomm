# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-05-21
- Primary product surfaces:
  - Маркетплейс фермерских товаров: каталог, карточка товара, корзина, заказ, профиль, кабинет продавца, админ/модерация.
- Evidence reviewed:
  - `C:\dipomm\templates\react.html`
  - `C:\dipomm\static\react-ui.css`
  - `C:\dipomm\static\react-app.js`
  - `C:\dipomm\README.md`

## Brand
- Personality:
  - Тёплый, живой, приземлённый, “фермерский”, без премиальной холодности.
- Trust signals:
  - Ясные статусы заказа и оплаты, видимые данные продавца, сертификаты, предсказуемые действия.
- Avoid:
  - Перегруженные декоративные паттерны, агрессивные эффекты, нечитабельные цветовые сочетания.

## Product goals
- Goals:
  - Быстрый путь к покупке локальных продуктов.
  - Понятные сценарии для покупателя и продавца.
  - Стабильное отображение интерфейса на мобильных и desktop.
- Non-goals:
  - Сложная editorial-лента или “соцсеть”.
  - Усложнённая анимация в ущерб скорости.
- Success signals:
  - Низкое число визуальных багов/переполнений.
  - Снижение числа ошибок и отмен в корзине/чекауте.

## Personas and jobs
- Primary personas:
  - Покупатель продуктов.
  - Продавец (фермер/поставщик).
  - Оператор/модератор/бухгалтер.
- User jobs:
  - Найти товар, сравнить цену, оформить заказ.
  - Продавцу: управлять карточками товарами и заказами.
  - Оператору: быстро обрабатывать заявки/обращения.
- Key contexts of use:
  - Мобильный просмотр каталога и корзины.
  - Desktop-работа продавца и модерации.

## Information architecture
- Primary navigation:
  - Верхняя навигация + действия пользователя в шапке.
- Core routes/screens:
  - Главная, каталог/поиск, карточка, корзина, заказ, профиль, seller/admin кабинеты.
- Content hierarchy:
  - Поиск и товары -> карточка -> корзина/чекаут -> статус заказа.

## Design principles
- Principle 1:
  - Контент и действия важнее декора: крупные кликабельные зоны, понятные CTA.
- Principle 2:
  - Предсказуемая адаптивность: без горизонтального скролла и обрезаний.
- Tradeoffs:
  - Чуть более простая композиция на мобильных ради стабильности и читаемости.

## Visual language
- Color:
  - Светлая натуральная палитра (салатовые/землистые акценты), нейтральный фон.
- Typography:
  - Базовый шрифт Marmelad с fallback-стеком.
- Spacing/layout rhythm:
  - 8px-сетка, внешние отступы через `.wrap`.
- Shape/radius/elevation:
  - Скругления ~8px, мягкие тени только у фокусных элементов.
- Motion:
  - Минимальные hover-переходы, без тяжёлых анимаций.
- Imagery/iconography:
  - Фото товаров + аккуратные плейсхолдеры, читаемые иконки действий.

## Components
- Existing components to reuse:
  - `.react-btn`, `.react-icon-btn`, `.react-card`, `.react-panel`, `.react-product-card`, `.react-modal`, `.react-form-grid`.
- New/changed components:
  - Нет новых сущностей; корректируются адаптивные правила существующих блоков.
- Variants and states:
  - Secondary/danger/disabled у кнопок, состояния loading/empty/error/success в экранах.
- Token/component ownership:
  - Токены и визуальные правила в `react-ui.css`; разметка и поведение в `react-app.js`.

## Accessibility
- Target standard:
  - Базовый WCAG 2.1 AA для контраста и клавиатурной навигации.
- Keyboard/focus behavior:
  - Интерактивные элементы должны сохранять фокусируемость; не скрывать outline без замены.
- Contrast/readability:
  - Достаточный контраст текста и состояний (особенно muted-тексты и статусы).
- Screen-reader semantics:
  - Использовать корректные заголовки, формы и подписи.
- Reduced motion and sensory considerations:
  - Ограниченные эффекты; важные действия не завязаны на анимацию.

## Responsive behavior
- Supported breakpoints/devices:
  - Mobile-first поддержка от ~320px, tablet и desktop.
- Layout adaptations:
  - Переход сложных гридов в одну колонку, перенос действий и навигации.
- Touch/hover differences:
  - На touch-устройствах приоритет крупным контролам и расстояниям между ними.

## Interaction states
- Loading:
  - Блокировка submit-кнопок и визуальная индикация.
- Empty:
  - Явные пустые состояния (`.react-empty`) с понятной подсказкой.
- Error:
  - Alert-панели и fallback-экран ошибки.
- Success:
  - Текстовые подтверждения в карточках/панелях.
- Disabled:
  - Сниженная непрозрачность и курсор состояния.
- Offline/slow network, if applicable:
  - Корректная деградация карточек/изображений до плейсхолдеров.

## Content voice
- Tone:
  - Дружелюбный, прямой, без канцелярита.
- Terminology:
  - Простые торговые термины: товар, корзина, заказ, доставка, продавец.
- Microcopy rules:
  - Короткие CTA-глаголы, предсказуемые названия статусов.

## Implementation constraints
- Framework/styling system:
  - React + статический CSS (`react-ui.css`) + Bootstrap reset/base.
- Design-token constraints:
  - Новые переменные не обязательны; предпочтительно расширять текущие классы.
- Performance constraints:
  - Минимизировать тяжёлые эффекты и лишние перерисовки.
- Compatibility constraints:
  - Современные браузеры мобильных/desktop; без зависимости от экспериментальных API.
- Test/screenshot expectations:
  - Проверка без горизонтального скролла и визуальных переполнений на ключевых экранах.

## Open questions
- [ ] Нужны ли отдельные бренд-гайды (логотип/цвета/тональность) от владельца продукта / owner: product / impact: medium
- [ ] Какой минимальный набор поддерживаемых браузеров официально считаем целевым / owner: tech / impact: medium
