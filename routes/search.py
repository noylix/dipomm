import difflib
import re

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from auth import get_optional_user
from database import get_db
from models import OrderItem, Product, SellerReview, User
from marketplace_utils import compact_text

router = APIRouter()
templates = Jinja2Templates(directory="templates")

TOKEN_RE = re.compile(r"[A-Za-z\u0400-\u04FF0-9]+")


def _normalize_token(value: str) -> str:
    raw = (value or "").strip().lower().replace("\u0451", "\u0435")
    return re.sub(r"[^a-z\u0430-\u044f0-9]+", "", raw)


def _is_displayable_text(value: str | None) -> bool:
    if not value:
        return False
    cleaned = str(value).strip()
    return bool(cleaned) and "?" not in cleaned


def _tokenize(value: str) -> list[str]:
    tokens: list[str] = []
    for token in TOKEN_RE.findall(value or ""):
        normalized = _normalize_token(token)
        if normalized:
            tokens.append(normalized)
    return tokens


def _search_vocabulary(db: Session) -> list[str]:
    values: list[str] = []

    product_rows = db.query(Product.name).filter(Product.status == "approved").all()
    for (name,) in product_rows:
        if _is_displayable_text(name):
            values.extend(_tokenize(str(name)))

    return sorted({token for token in values if len(token) >= 3})


def _correct_query(raw_query: str, vocabulary: list[str]) -> tuple[str, bool]:
    tokens = _tokenize(raw_query)
    if not tokens:
        return "", False

    corrected: list[str] = []
    changed = False
    vocab_set = set(vocabulary)

    for token in tokens:
        if token in vocab_set:
            corrected.append(token)
            continue
        matches = difflib.get_close_matches(token, vocabulary, n=1, cutoff=0.58)
        if matches:
            corrected.append(matches[0])
            changed = True
        else:
            corrected.append(token)

    return " ".join(corrected), changed


def _phrase_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower().replace("\u0451", "\u0435"))


def _has_prefix(value: str | None, term: str) -> bool:
    return any(token.startswith(term) for token in _tokenize(value or ""))


def _name_search_terms(value: str | None) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()

    def add(term: str | None) -> None:
        normalized = compact_text(term)
        if normalized and len(normalized) >= 2 and normalized not in seen:
            seen.add(normalized)
            terms.append(normalized)

    for token in _tokenize(value or ""):
        add(token)
    add(value)
    return terms


def _mode_score(value: str | None, query: str, terms: list[str], weights: dict[str, float]) -> float:
    compact_value = compact_text(value or "")
    phrase_value = _phrase_text(value)
    phrase_query = _phrase_text(query).strip('"')
    compact_query = compact_text(query)
    score = 0.0

    # Exact Match: exact product name.
    if compact_query and compact_value == compact_query:
        score += weights.get("exact", 0)

    # Phrase Search: exact multi-word quote or compound name inside normalized text.
    if phrase_query and " " in phrase_query and phrase_query in phrase_value:
        score += weights.get("phrase", 0)

    for term in terms:
        if not term or len(term) < 2:
            continue
        # Prefix Search: autocomplete-style match from the beginning of a word.
        if _has_prefix(value, term):
            score += weights.get("prefix", 0)
        # Substring Search: flexible match inside longer text fields.
        if term in compact_value:
            score += weights.get("substring", 0)

    return score


def _relevance_score(
    product: Product,
    seller: User | None,
    raw_query: str,
    expanded_terms: list[str],
    avg_rating: float | None,
    sold_count: int | None,
) -> float:
    if not raw_query:
        return 0.0

    normalized_query = compact_text(raw_query)
    product_name = compact_text(product.name or "")
    score = 0.0

    product_name_score = _mode_score(
        product.name,
        raw_query,
        expanded_terms,
        {"exact": 220, "phrase": 170, "prefix": 90, "substring": 65},
    )
    score += product_name_score

    if normalized_query:
        if product_name == normalized_query:
            score += 200
        elif normalized_query and normalized_query in product_name:
            score += 120

    for index, term in enumerate(expanded_terms):
        if not term or len(term) < 2:
            continue
        synonym_priority = max(0, 8 - index)
        if term in product_name:
            score += 34 + synonym_priority

    if product_name_score <= 0:
        return 0.0

    if product.discount_price and float(product.discount_price or 0) > 0:
        score += 4
    score += min(float(avg_rating or 0) * 2.5, 12.5)
    score += min(float(sold_count or 0) * 0.2, 10)
    return score


@router.get("/search", response_class=HTMLResponse)
def search_page(
    request: Request,
    db: Session = Depends(get_db),
    q: str = "",
    page: int = 1,
):
    user = get_optional_user(request, db)
    page = max(page, 1)

    rating_subq = (
        db.query(
            SellerReview.seller_id.label("seller_id"),
            func.avg(SellerReview.rating).label("avg_rating"),
            func.count(SellerReview.id).label("review_count"),
        )
        .filter(SellerReview.status == "approved")
        .group_by(SellerReview.seller_id)
        .subquery()
    )

    popularity_subq = (
        db.query(
            OrderItem.product_id.label("product_id"),
            func.coalesce(func.sum(OrderItem.quantity), 0).label("sold_count"),
        )
        .group_by(OrderItem.product_id)
        .subquery()
    )

    base_query = (
        db.query(Product, User, rating_subq.c.avg_rating, rating_subq.c.review_count, popularity_subq.c.sold_count)
        .join(User, Product.owner_id == User.id)
        .outerjoin(rating_subq, Product.owner_id == rating_subq.c.seller_id)
        .outerjoin(popularity_subq, Product.id == popularity_subq.c.product_id)
        .filter(
            Product.status == "approved",
            or_(User.is_approved == 1, Product.owner_id == None),
        )
    )

    applied_query = (q or "").strip()
    corrected_query = ""
    correction_used = False

    rows = base_query.all()
    search_query = applied_query
    expanded_terms = _name_search_terms(search_query)

    def build_scored_rows(query_text: str) -> list[tuple[Product, User, float, int, int, float]]:
        terms = _name_search_terms(query_text)
        result = []
        seen_ids = set()
        for product, seller, avg_rating, review_count, sold_count in rows:
            if product.id in seen_ids:
                continue
            seen_ids.add(product.id)
            score = _relevance_score(product, seller, query_text, terms, avg_rating, sold_count)
            if not query_text or score >= 12:
                result.append((product, seller, avg_rating, review_count, sold_count, score))
        return result

    scored_rows = build_scored_rows(search_query)
    if applied_query and not scored_rows:
        vocabulary = _search_vocabulary(db)
        corrected_query, correction_used = _correct_query(applied_query, vocabulary)
        if correction_used and corrected_query:
            corrected_rows = build_scored_rows(corrected_query)
            if corrected_rows:
                search_query = corrected_query
                expanded_terms = _name_search_terms(search_query)
                scored_rows = corrected_rows

    scored_rows.sort(key=lambda row: (-row[5], -(float(row[2] or 0)), -(int(row[4] or 0)), -(row[0].id or 0)))

    per_page = 20
    total = len(scored_rows)
    total_pages = (total + per_page - 1) // per_page
    if total_pages and page > total_pages:
        page = total_pages
    rows = scored_rows[(page - 1) * per_page: page * per_page]

    products = []
    for product, seller, avg_rating, review_count, sold_count, score in rows:
        product._seller_rating = round(avg_rating, 1) if avg_rating else None
        product._review_count = int(review_count or 0)
        product._sold_count = int(sold_count or 0)
        product._search_score = round(score, 2)
        products.append(product)

    search_hint = None
    if correction_used and corrected_query and corrected_query != " ".join(_tokenize(applied_query)):
        search_hint = (
            f'\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b '
            f'\u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b '
            f'\u0434\u043b\u044f "{corrected_query}"'
        )

    return templates.TemplateResponse(
        "search",
        {
            "request": request,
            "user": user,
            "products": products,
            "q": applied_query,
            "page": page,
            "total_pages": total_pages,
            "search_hint": search_hint,
            "corrected_query": corrected_query if correction_used else "",
        },
    )


@router.get("/api/search/suggestions")
def search_suggestions(q: str = "", db: Session = Depends(get_db)):
    raw_query = (q or "").strip()
    if len(raw_query) < 2:
        return {"suggestions": [], "corrected_query": ""}

    normalized_query = compact_text(raw_query)
    vocabulary = _search_vocabulary(db)
    corrected_query, correction_used = _correct_query(raw_query, vocabulary)

    suggestions: list[str] = []
    seen: set[str] = set()

    def add_suggestion(value: str | None) -> None:
        if not _is_displayable_text(value):
            return
        text = str(value).strip()
        if text not in seen:
            seen.add(text)
            suggestions.append(text)

    if correction_used and corrected_query:
        add_suggestion(corrected_query)

    product_rows = db.query(Product.name).filter(Product.status == "approved").all()
    candidate_values: list[tuple[int, str]] = []
    for (name,) in product_rows:
        normalized_value = compact_text(name or "")
        if (
            not normalized_value
            or not (
                normalized_value.startswith(normalized_query)
                or _has_prefix(name, normalized_query)
            )
        ):
            continue
        score = 35
        if normalized_value == normalized_query:
            score += 100
        elif normalized_value.startswith(normalized_query):
            score += 60
        candidate_values.append((score, str(name).strip()))

    for _, value in sorted(candidate_values, key=lambda item: (-item[0], item[1].lower())):
        add_suggestion(value)
        if len(suggestions) >= 8:
            break

    if len(suggestions) < 8:
        for token in difflib.get_close_matches(normalized_query, vocabulary, n=5, cutoff=0.58):
            add_suggestion(token)

    return {
        "suggestions": suggestions[:8],
        "corrected_query": corrected_query if correction_used else "",
    }
