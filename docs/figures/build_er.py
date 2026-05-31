#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from pathlib import Path
import subprocess

DIR = Path(__file__).parent
SVG = DIR / "fig-er-communications.svg"
PNG = DIR / "fig-er-communications.png"

SVG.write_text("""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#333"/>
    </marker>
    <style>
      .t  { font: 700 20px Arial, sans-serif; fill: #111; }
      .st { font: 400 13px Arial, sans-serif; fill: #555; }
      .en { font: 700 14px Arial, sans-serif; fill: #111; }
      .a  { font: 400 11px Arial, sans-serif; fill: #333; }
      .pk { font: 700 11px Arial, sans-serif; fill: #1d4ed8; }
      .fk { font: 400 11px Arial, sans-serif; fill: #7c3aed; }
      .c  { font: 700 11px Arial, sans-serif; fill: #111; }
      .cap{ font: 400 12px Arial, sans-serif; fill: #444; }
      .lg { font: 400 11px Arial, sans-serif; fill: #333; }
    </style>
  </defs>
  <rect width="1200" height="900" fill="#ffffff"/>
  <text x="600" y="40" text-anchor="middle" class="t">ER-диаграмма базы данных</text>
  <text x="600" y="65" text-anchor="middle" class="st">Модуль коммуникаций и управления сообществом · маркетплейс «Свои Ряды»</text>

  <rect x="40"  y="110" width="200" height="24" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="5,3"/>
  <rect x="40"  y="134" width="200" height="96" fill="#fafafa" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="5,3"/>
  <text x="140" y="128" text-anchor="middle" class="en">users</text>
  <text x="52"  y="152" class="pk">PK  id</text>
  <text x="52"  y="168" class="a">email, role</text>
  <text x="52"  y="184" class="a">full_name, farm_name</text>
  <text x="52"  y="200" class="a">is_approved</text>

  <rect x="40"  y="280" width="200" height="24" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="5,3"/>
  <rect x="40"  y="304" width="200" height="72" fill="#fafafa" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="5,3"/>
  <text x="140" y="298" text-anchor="middle" class="en">orders</text>
  <text x="52"  y="322" class="pk">PK  id</text>
  <text x="52"  y="338" class="fk">FK  user_id</text>
  <text x="52"  y="354" class="a">status, total_price</text>

  <rect x="40"  y="420" width="200" height="24" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="5,3"/>
  <rect x="40"  y="444" width="200" height="72" fill="#fafafa" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="5,3"/>
  <text x="140" y="438" text-anchor="middle" class="en">products</text>
  <text x="52"  y="462" class="pk">PK  id</text>
  <text x="52"  y="478" class="fk">FK  owner_id</text>
  <text x="52"  y="494" class="a">name, price, status</text>

  <rect x="320" y="110" width="220" height="24" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>
  <rect x="320" y="134" width="220" height="96" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
  <text x="430" y="128" text-anchor="middle" class="en">notifications</text>
  <text x="332" y="152" class="pk">PK  id</text>
  <text x="332" y="168" class="fk">FK  user_id (NULL)</text>
  <text x="332" y="184" class="a">type, subject, body</text>
  <text x="332" y="200" class="a">is_read, created_at</text>

  <rect x="320" y="260" width="240" height="24" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>
  <rect x="320" y="284" width="240" height="136" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
  <text x="440" y="278" text-anchor="middle" class="en">complaints</text>
  <text x="332" y="302" class="pk">PK  id</text>
  <text x="332" y="318" class="fk">FK  user_id, target_user_id</text>
  <text x="332" y="334" class="fk">FK  target_product_id, order_id</text>
  <text x="332" y="350" class="a">category, text, status</text>
  <text x="332" y="366" class="a">admin_response, attachment_path</text>
  <text x="332" y="382" class="a">assigned_to_role</text>
  <text x="332" y="402" class="a">created_at, updated_at</text>

  <rect x="320" y="460" width="220" height="24" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>
  <rect x="320" y="484" width="220" height="112" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
  <text x="430" y="478" text-anchor="middle" class="en">reviews</text>
  <text x="332" y="502" class="pk">PK  id</text>
  <text x="332" y="518" class="fk">FK  user_id, product_id, order_id</text>
  <text x="332" y="534" class="a">rating, text, status</text>
  <text x="332" y="550" class="a">seller_response</text>
  <text x="332" y="566" class="a">created_at</text>

  <rect x="320" y="620" width="240" height="24" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>
  <rect x="320" y="644" width="240" height="96" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
  <text x="440" y="638" text-anchor="middle" class="en">seller_reviews</text>
  <text x="332" y="662" class="pk">PK  id</text>
  <text x="332" y="678" class="fk">FK  user_id, seller_id, order_id</text>
  <text x="332" y="694" class="a">rating, text, status</text>
  <text x="332" y="710" class="a">created_at</text>

  <rect x="640" y="280" width="250" height="24" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>
  <rect x="640" y="304" width="250" height="152" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
  <text x="765" y="298" text-anchor="middle" class="en">conversations</text>
  <text x="652" y="322" class="pk">PK  id</text>
  <text x="652" y="338" class="a">type</text>
  <text x="652" y="354" class="fk">FK  buyer_id, farmer_id</text>
  <text x="652" y="370" class="fk">FK  admin_id, accountant_id</text>
  <text x="652" y="386" class="fk">FK  order_id, product_id</text>
  <text x="652" y="402" class="fk">FK  complaint_id</text>
  <text x="652" y="418" class="a">status, created_at, updated_at</text>

  <rect x="960" y="310" width="200" height="24" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>
  <rect x="960" y="334" width="200" height="112" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
  <text x="1060" y="328" text-anchor="middle" class="en">messages</text>
  <text x="972" y="352" class="pk">PK  id</text>
  <text x="972" y="368" class="fk">FK  conversation_id</text>
  <text x="972" y="384" class="fk">FK  sender_id</text>
  <text x="972" y="400" class="a">sender_role, text</text>
  <text x="972" y="416" class="a">attachment_path, is_read</text>
  <text x="972" y="432" class="a">created_at</text>

  <line x1="240" y1="170" x2="320" y2="170" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="268" y="162" class="c">1</text><text x="288" y="162" class="c">N</text>

  <line x1="240" y1="200" x2="320" y2="310" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="262" y="248" class="c">1</text><text x="282" y="248" class="c">N</text>

  <line x1="240" y1="340" x2="320" y2="340" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="268" y="332" class="c">1</text><text x="288" y="332" class="c">N</text>

  <line x1="240" y1="470" x2="320" y2="370" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="262" y="410" class="c">1</text><text x="282" y="410" class="c">N</text>

  <line x1="240" y1="220" x2="320" y2="520" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="262" y="370" class="c">1</text><text x="282" y="370" class="c">N</text>

  <line x1="240" y1="490" x2="320" y2="530" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="268" y="502" class="c">1</text><text x="288" y="502" class="c">N</text>

  <line x1="240" y1="230" x2="320" y2="680" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="262" y="460" class="c">1</text><text x="282" y="460" class="c">N</text>

  <line x1="560" y1="352" x2="640" y2="352" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="582" y="344" class="c">1</text><text x="608" y="344" class="c">0..1</text>

  <line x1="890" y1="380" x2="960" y2="380" stroke="#333" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="912" y="372" class="c">1</text><text x="932" y="372" class="c">N</text>

  <rect x="640" y="520" width="520" height="130" fill="#fff" stroke="#ccc" stroke-width="1" rx="4"/>
  <text x="660" y="548" class="en">Условные обозначения</text>
  <rect x="660" y="560" width="20" height="14" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
  <text x="688" y="572" class="lg">Таблица модуля коммуникаций</text>
  <rect x="660" y="582" width="20" height="14" fill="#fafafa" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="4,2"/>
  <text x="688" y="594" class="lg">Связанная таблица маркетплейса</text>
  <text x="660" y="618" class="lg">PK — первичный ключ;  FK — внешний ключ</text>
  <text x="660" y="638" class="lg">Связи users/orders/products → conversations и messages заданы через FK в таблицах</text>

  <text x="600" y="870" text-anchor="middle" class="cap">Рисунок — ER-диаграмма базы данных модуля коммуникаций и управления сообществом</text>
</svg>
""", encoding="utf-8")

subprocess.run(["qlmanage", "-t", "-s", "2400", "-o", str(DIR), str(SVG)], check=True)
tmp = SVG.with_suffix(".svg.png")
if tmp.exists():
    tmp.replace(PNG)
print("OK", PNG)
