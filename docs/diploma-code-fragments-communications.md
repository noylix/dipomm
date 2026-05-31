# Модуль коммуникаций — краткие фрагменты для диплома

**Для Word:** [`diploma-communications-for-word.html`](diploma-communications-for-word.html) — таблицы + 7 коротких листингов (~10–15 строк), готово к открытию в Word.

Полный исходный код: `models.py`, `routes/conversations.py`, `routes/complaints.py`, `routes/reviews.py`, `routes/notifications.py`, `tests/test_smoke.py`.

---

## Листинг 1 — `models.py`

```python
class Complaint(Base):
    __tablename__ = "complaints"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    category = Column(String(100), default="other")
    text = Column(String(2000), nullable=False)
    status = Column(String(50), default="new")
    admin_response = Column(String(2000), nullable=True)

class Message(Base):
    __tablename__ = "messages"
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    sender_role = Column(String(50), nullable=False)
    text = Column(String(2000), nullable=False)
```

## Листинг 2 — `routes/conversations.py`

```python
def upsert_complaint_conversation(db, complaint):
    conversation = db.query(Conversation).filter(
        Conversation.type == "complaint",
        Conversation.complaint_id == complaint.id,
    ).first()
    if not conversation:
        db.add(Conversation(type="complaint", buyer_id=complaint.user_id,
                            complaint_id=complaint.id))
    db.commit()
    return conversation
```

## Листинг 3 — `routes/complaints.py` (создание)

```python
@router.post("/create")
def create_complaint(...):
    complaint = Complaint(user_id=user.id, category=category, text=text, status="new")
    db.add(complaint)
    db.commit()
    upsert_complaint_conversation(db, complaint)
```

## Листинг 4 — `routes/complaints.py` (ответ)

```python
complaint.status = status
if response_text:
    db.add(Notification(user_id=complaint.user_id, subject=f"Ответ на жалобу #{complaint.id}", ...))
    db.add(Message(conversation_id=conversation.id, text=response_text[:2000]))
db.commit()
```

## Листинг 5 — `routes/reviews.py`

```python
order = db.query(Order).filter(Order.id == order_id, Order.status == "completed").first()
db.add(Review(user_id=user.id, product_id=product_id, order_id=order_id, status="pending"))
# модерация: review.status = "approved"
```

## Листинг 6 — `routes/notifications.py`

```python
def send_notification(db, user_id, type, subject, body):
    db.add(Notification(user_id=user_id, subject=subject, body=body, is_read=0))
    db.commit()
```

## Листинг 7 — `tests/test_smoke.py`

```python
def test_admin_complaint_response_persists_and_notifies_client(client):
    client.post("/complaints/create", data={"category": "other", "text": "..."})
    client.post(f"/complaints/admin/{id}/status",
                data={"status": "processing", "response_text": answer})
    assert saved.admin_response == answer
    assert db.query(Notification).filter(...).count() == 1
```

Таблицы требований и тест-кейсов — в HTML для Word (таблицы 1–3).
