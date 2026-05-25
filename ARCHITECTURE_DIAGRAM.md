# Диаграмма архитектуры проекта

Ниже схема в стиле исходного примера, но уже под ваш проект. Я сделал её честной: с теми слоями, которые реально видны в коде `main.py`, `routes/`, `models.py`, `database.py` и вспомогательных модулях.

```mermaid
flowchart TB
  U[Users<br/>buyer / seller / admin / accountant]

  subgraph P["Presentation Layer"]
    UI["Jinja2 templates<br/>templates/*"]
    RUI["React bridge<br/>main.py + react.html"]
    AS["Static assets<br/>static/react-app.js<br/>static/react-ui.css"]
  end

  subgraph S["Service Layer"]
    APP["FastAPI app<br/>main.py"]
    RT["Routers<br/>users, cart, order, seller, admin,<br/>payment, search, chat, complaints, ..."]
  end

  subgraph B["Business Layer"]
    AUTH["auth.py<br/>sessions, password hash, roles"]
    MAP["marketplace_utils.py<br/>pricing, search, commission"]
    LOG["logistics.py<br/>shipment workflow"]
    STAT["order_statuses.py<br/>status rules"]
    WF["Route workflows<br/>checkout, moderation, support,<br/>wallet, refunds, conversations"]
  end

  subgraph D["Data Layer"]
    DB["database.py<br/>SQLAlchemy engine + SessionLocal"]
    ORM["models.py<br/>ORM entities"]
    STORE["SQLite / PostgreSQL<br/>farmmarket.db / runtime_test_ok.db"]
  end

  subgraph C["Cross Cutting"]
    SEC["Session middleware<br/>role gate / access control"]
    SER["TemplateResponse bridge<br/>JSON-safe React props"]
    AUD["Shared concerns<br/>notifications, validation, logging"]
  end

  subgraph X["External Systems"]
    PAY["YooKassa API"]
    DEL["Delivery providers<br/>tracking / shipment updates"]
  end

  U --> P
  P --> S
  S --> B
  B --> D
  B --> X

  C -.-> P
  C -.-> S
  C -.-> B

  D --> STORE
  D -.-> X
```

## Краткая расшифровка

- `Presentation Layer` отвечает за шаблоны, React-обвязку и статику.
- `Service Layer` - это `FastAPI` и маршруты в `routes/`.
- `Business Layer` содержит прикладные сценарии и общие правила домена.
- `Data Layer` - ORM-модели и подключение к БД.
- `Cross Cutting` - авторизация, доступы и общие механики, которые проходят через несколько слоёв.
- `External Systems` - реальные внешние интеграции, которые уже видны в коде.

