from __future__ import annotations

import os
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user
from database import get_db
from models import Complaint, Conversation, Message, Order, OrderItem, Product, User

router = APIRouter(prefix="/conversations", tags=["conversations"])

FINANCE_CATEGORIES = {"payment"}
BUYER_COMPLAINT_CATEGORIES = {"payment", "delivery", "quality", "order", "seller", "buyer", "other"}
ORDER_MESSAGE_ROLES = {"user", "seller"}
COMPLAINT_MESSAGE_ROLES = {"user", "admin", "accountant"}


def _seller_names(order: Order, db: Session) -> list[tuple[int, str]]:
    sellers: dict[int, str] = {}
    for item in order.items or []:
        owner = item.product.owner if item.product else None
        if owner and owner.id not in sellers:
            sellers[owner.id] = owner.farm_name or owner.full_name or owner.email
    return list(sellers.items())


def _order_items_for_seller(order: Order, seller_id: int) -> list[OrderItem]:
    items = []
    for item in order.items or []:
        if item.product and item.product.owner_id == seller_id:
            items.append(item)
    return items


def _ensure_order_conversation(db: Session, order: Order, buyer_id: int, farmer_id: int) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.type == "order_chat",
            Conversation.order_id == order.id,
            Conversation.buyer_id == buyer_id,
            Conversation.farmer_id == farmer_id,
        )
        .first()
    )
    if conversation:
        return conversation
    conversation = Conversation(
        type="order_chat",
        buyer_id=buyer_id,
        farmer_id=farmer_id,
        order_id=order.id,
        status="open",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def _ensure_product_conversation(db: Session, product: Product, buyer_id: int) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.type == "product_question",
            Conversation.product_id == product.id,
            Conversation.buyer_id == buyer_id,
            Conversation.farmer_id == product.owner_id,
        )
        .first()
    )
    if conversation:
        return conversation
    conversation = Conversation(
        type="product_question",
        buyer_id=buyer_id,
        farmer_id=product.owner_id,
        product_id=product.id,
        status="open",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def _conversation_payload(conv: Conversation, db: Session) -> dict:
    last_message = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .first()
    )
    buyer = conv.buyer
    farmer = conv.farmer
    return {
        "conversation": conv,
        "last_message": last_message,
        "buyer_name": buyer.full_name or buyer.farm_name or buyer.email if buyer else "-",
        "farmer_name": farmer.farm_name or farmer.full_name or farmer.email if farmer else "-",
        "order_number": conv.order.order_number if conv.order else None,
        "product_name": conv.product.name if conv.product else None,
        "complaint_id": conv.complaint_id,
    }


def _allowed_to_view(user: User, conversation: Conversation) -> bool:
    if user.role == "user":
        return conversation.buyer_id == user.id
    if user.role == "seller":
        return conversation.farmer_id == user.id or (conversation.type == "support_request" and conversation.buyer_id == user.id)
    if user.role == "admin":
        return conversation.type in {"complaint", "support_request"} or conversation.admin_id == user.id
    if user.role == "accountant":
        return conversation.type == "finance_request" or conversation.accountant_id == user.id
    return False


def _allowed_to_send(user: User, conversation: Conversation) -> bool:
    if user.role == "user":
        return conversation.buyer_id == user.id and conversation.type in {"order_chat", "product_question", "complaint"}
    if user.role == "seller":
        return (conversation.farmer_id == user.id or (conversation.type == "support_request" and conversation.buyer_id == user.id)) and conversation.type in {"order_chat", "product_question", "support_request"}
    if user.role == "admin":
        return conversation.type in {"complaint", "support_request"}
    if user.role == "accountant":
        return conversation.type == "finance_request"
    return False


def _save_attachment(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    base_dir = os.path.join("static", "uploads", "messages")
    os.makedirs(base_dir, exist_ok=True)
    ext = os.path.splitext(upload.filename)[1].lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(base_dir, filename)
    with open(path, "wb") as file_obj:
        file_obj.write(upload.file.read())
    return f"/static/uploads/messages/{filename}"


def upsert_finance_conversation(db: Session, complaint: Complaint) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.type == "finance_request", Conversation.complaint_id == complaint.id)
        .first()
    )
    if conversation:
        conversation.accountant_id = conversation.accountant_id or None
        conversation.status = complaint.status or conversation.status
    else:
        conversation = Conversation(
            type="finance_request",
            buyer_id=complaint.user_id,
            farmer_id=complaint.target_user_id,
            complaint_id=complaint.id,
            accountant_id=None,
            status=complaint.status or "open",
        )
        db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def upsert_complaint_conversation(db: Session, complaint: Complaint) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.type == "complaint", Conversation.complaint_id == complaint.id)
        .first()
    )
    if conversation:
        conversation.status = complaint.status or conversation.status
    else:
        conversation = Conversation(
            type="complaint",
            buyer_id=complaint.user_id,
            farmer_id=complaint.target_user_id,
            admin_id=None,
            complaint_id=complaint.id,
            order_id=complaint.order_id,
            product_id=complaint.target_product_id,
            status=complaint.status or "open",
        )
        db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def upsert_support_conversation(db: Session, complaint: Complaint) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.type == "support_request", Conversation.complaint_id == complaint.id)
        .first()
    )
    if conversation:
        conversation.status = complaint.status or conversation.status
    else:
        conversation = Conversation(
            type="support_request",
            buyer_id=complaint.user_id,
            admin_id=None,
            complaint_id=complaint.id,
            status=complaint.status or "open",
        )
        db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/")
def list_conversations(request: Request, kind: str = "", db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user", "seller", "admin", "accountant"])
    if guard:
        return guard

    base_query = db.query(Conversation).options(
        joinedload(Conversation.buyer),
        joinedload(Conversation.farmer),
        joinedload(Conversation.order),
        joinedload(Conversation.product),
        joinedload(Conversation.complaint),
    )

    if user.role == "user":
        conversations = (
            base_query
            .filter(Conversation.buyer_id == user.id)
            .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
            .all()
        )
    elif user.role == "seller":
        conversations = (
            base_query
            .filter(
                or_(
                    Conversation.farmer_id == user.id,
                    # Seller-originated support requests are opened as buyer-owned conversations.
                    (Conversation.type == "support_request") & (Conversation.buyer_id == user.id),
                )
            )
            .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
            .all()
        )
    elif user.role == "admin":
        conversations = (
            base_query
            .filter(
                or_(
                    Conversation.type.in_(["complaint", "support_request"]),
                    Conversation.admin_id == user.id,
                )
            )
            .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
            .all()
        )
    else:  # accountant
        conversations = (
            base_query
            .filter(
                or_(
                    Conversation.type == "finance_request",
                    Conversation.accountant_id == user.id,
                )
            )
            .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
            .all()
        )

    allowed_kinds = {"", "all", "order_chat", "product_question", "support_request", "complaint", "finance_request"}
    if kind not in allowed_kinds:
        kind = ""
    if kind and kind != "all":
        conversations = [conv for conv in conversations if conv.type == kind]

    items = [_conversation_payload(conv, db) for conv in conversations]
    return request.app.state.templates.TemplateResponse(
        request,
        "conversations",
        {
            "user": user,
            "conversations": items,
            "kind": kind or "all",
        },
    )


@router.get("/order/{order_id}")
def open_order_conversation(order_id: int, request: Request, seller_id: int = 0, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user", "seller"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner), joinedload(Order.user))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        return RedirectResponse("/order/orders", status_code=303)

    if user.role == "user":
        if order.user_id != user.id:
            return RedirectResponse("/order/orders", status_code=303)
        seller_ids = [item.product.owner_id for item in order.items if item.product and item.product.owner_id]
        unique_sellers = []
        seen = set()
        for sid in seller_ids:
            if sid not in seen:
                seen.add(sid)
                unique_sellers.append(sid)
        if not seller_id:
            seller_id = unique_sellers[0] if len(unique_sellers) == 1 else 0
        if not seller_id and len(unique_sellers) > 1:
            return RedirectResponse("/order/orders", status_code=303)
        if seller_id not in unique_sellers:
            return RedirectResponse("/order/orders", status_code=303)
        conversation = _ensure_order_conversation(db, order, user.id, seller_id)
        return RedirectResponse(f"/conversations/{conversation.id}", status_code=303)

    if user.role == "seller":
        if not any(item.product and item.product.owner_id == user.id for item in order.items or []):
            return RedirectResponse("/seller/orders", status_code=303)
        conversation = _ensure_order_conversation(db, order, order.user_id, user.id)
        return RedirectResponse(f"/conversations/{conversation.id}", status_code=303)

    return RedirectResponse("/order/orders", status_code=303)


@router.get("/product/{product_id}")
def open_product_conversation(product_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or not product.owner_id:
        return RedirectResponse("/catalog", status_code=303)

    conversation = _ensure_product_conversation(db, product, user.id)
    return RedirectResponse(f"/conversations/{conversation.id}", status_code=303)


# Backward-compatible aliases for old frontend links.
@router.get("/item/{product_id}")
def open_product_conversation_alias_item(product_id: int, request: Request, db: Session = Depends(get_db)):
    return open_product_conversation(product_id, request, db)


@router.get("/ask/{product_id}")
def open_product_conversation_alias_ask(product_id: int, request: Request, db: Session = Depends(get_db)):
    return open_product_conversation(product_id, request, db)


@router.get("/{conversation_id}")
def conversation_detail(conversation_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    conversation = (
        db.query(Conversation)
        .options(
            joinedload(Conversation.buyer),
            joinedload(Conversation.farmer),
            joinedload(Conversation.admin),
            joinedload(Conversation.accountant),
            joinedload(Conversation.order).joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner),
            joinedload(Conversation.product).joinedload(Product.owner),
            joinedload(Conversation.complaint),
        )
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if not conversation or not user or not _allowed_to_view(user, conversation):
        return RedirectResponse("/conversations/", status_code=303)

    messages = (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
    return request.app.state.templates.TemplateResponse(
        request,
        "conversation",
        {
            "user": user,
            "conversation": conversation,
            "messages": messages,
            "can_reply": _allowed_to_send(user, conversation),
        },
    )


@router.post("/{conversation_id}/message")
def conversation_message(
    conversation_id: int,
    request: Request,
    text: str = Form(""),
    attachment: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation or not user or not _allowed_to_send(user, conversation):
        return RedirectResponse("/conversations/", status_code=303)

    text = (text or "").strip()
    if len(text) < 1:
        request.session["notice_message"] = "Напишите сообщение."
        return RedirectResponse(f"/conversations/{conversation.id}", status_code=303)

    db.add(Message(
        conversation_id=conversation.id,
        sender_id=user.id,
        sender_role=user.role,
        text=text[:2000],
        attachment_path=_save_attachment(attachment),
        is_read=0,
    ))
    db.commit()
    request.session["notice_message"] = "Сообщение отправлено"
    return RedirectResponse(f"/conversations/{conversation.id}", status_code=303)
