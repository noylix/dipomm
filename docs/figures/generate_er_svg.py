#!/usr/bin/env python3
"""Generate proper ER-diagram SVG (UTF-8) for communications module."""

from pathlib import Path

SVG = Path(__file__).with_name("fig-er-communications.svg")
PNG = Path(__file__).with_name("fig-er-communications.png")

CONTENT = r'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="820" viewBox="0 0 1100 820" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <path d="M0,0 L9,3 L0,6 Z" fill="#1f2937"/>
    </marker>
    <style>
      .title { font-size: 18px; font-weight: 700; fill: #111827; }
      .subtitle { font-size: 12px; fill: #4b5563; }
      .entity-core { fill: #dbeafe; stroke: #1d4ed8; stroke-width: 2; }
      .entity-ext { fill: #f3f4f6; stroke: #6b7280; stroke-width: 1.5; stroke-dasharray: 6 4; }
      .entity-title { font-size: 13px; font-weight: 700; fill: #111827; }
      .attr { font-size: 10px; fill: #374151; }
      .pk { font-weight: 700; fill: #1d4ed8; }
      .fk { fill: #7c3aed; }
      .rel { stroke: #1f2937; stroke-width: 1.4; fill: none; marker-end: url(#arrow); }
      .card { font-size: 10px; fill: #111827; font-weight: 700; }
      .legend-box { fill: #fff; stroke: #d1d5db; stroke-width: 1; rx: 6; }
      .caption { font-size: 11px; fill: #374151; }
      .note { font-size: 9px; fill: #6b7280; font-style: italic; }
    </style>
  </defs>

  <text x="550" y="32" text-anchor="middle" class="title">ER-диаграмма модуля коммуникаций и управления сообществом</text>
  <text x="550" y="52" text-anchor="middle" class="subtitle">Маркетплейс «Свои Ряды» · SQLAlchemy / SQLite / MySQL</text>

  <!-- Внешние сущности -->
  <rect x="40" y="90" width="170" height="118" class="entity-ext" rx="6"/>
  <text x="125" y="112" text-anchor="middle" class="entity-title">users</text>
  <text x="50" y="132" class="attr pk">PK id</text>
  <text x="50" y="148" class="attr">email, role</text>
  <text x="50" y="164" class="attr">full_name, farm_name</text>
  <text x="50" y="180" class="attr">is_approved</text>
  <text x="50" y="196" class="note">покупатель, фермер, admin…</text>

  <rect x="40" y="260" width="170" height="92" class="entity-ext" rx="6"/>
  <text x="125" y="282" text-anchor="middle" class="entity-title">orders</text>
  <text x="50" y="302" class="attr pk">PK id</text>
  <text x="50" y="318" class="attr fk">FK user_id</text>
  <text x="50" y="334" class="attr">status, total_price</text>

  <rect x="40" y="390" width="170" height="92" class="entity-ext" rx="6"/>
  <text x="125" y="412" text-anchor="middle" class="entity-title">products</text>
  <text x="50" y="432" class="attr pk">PK id</text>
  <text x="50" y="448" class="attr fk">FK owner_id → users</text>
  <text x="50" y="464" class="attr">name, price, status</text>

  <!-- notifications -->
  <rect x="280" y="90" width="210" height="132" class="entity-core" rx="6"/>
  <text x="385" y="112" text-anchor="middle" class="entity-title">notifications</text>
  <text x="290" y="132" class="attr pk">PK id</text>
  <text x="290" y="148" class="attr fk">FK user_id (nullable)</text>
  <text x="290" y="164" class="attr">type, subject, body</text>
  <text x="290" y="180" class="attr">is_read, created_at</text>
  <text x="290" y="196" class="note">user_id = NULL → системное</text>

  <!-- complaints -->
  <rect x="280" y="260" width="230" height="178" class="entity-core" rx="6"/>
  <text x="395" y="282" text-anchor="middle" class="entity-title">complaints</text>
  <text x="290" y="302" class="attr pk">PK id</text>
  <text x="290" y="318" class="attr fk">FK user_id (автор)</text>
  <text x="290" y="334" class="attr fk">FK target_user_id</text>
  <text x="290" y="350" class="attr fk">FK target_product_id</text>
  <text x="290" y="366" class="attr fk">FK order_id</text>
  <text x="290" y="382" class="attr">category, text, status</text>
  <text x="290" y="398" class="attr">admin_response, attachment_path</text>
  <text x="290" y="414" class="attr">assigned_to_role</text>
  <text x="290" y="430" class="attr">created_at, updated_at</text>

  <!-- reviews -->
  <rect x="280" y="470" width="210" height="148" class="entity-core" rx="6"/>
  <text x="385" y="492" text-anchor="middle" class="entity-title">reviews</text>
  <text x="290" y="512" class="attr pk">PK id</text>
  <text x="290" y="528" class="attr fk">FK user_id</text>
  <text x="290" y="544" class="attr fk">FK product_id</text>
  <text x="290" y="560" class="attr fk">FK order_id</text>
  <text x="290" y="576" class="attr">rating, text, status</text>
  <text x="290" y="592" class="attr">seller_response</text>
  <text x="290" y="608" class="attr">pending / approved / rejected</text>

  <!-- seller_reviews -->
  <rect x="280" y="650" width="230" height="132" class="entity-core" rx="6"/>
  <text x="395" y="672" text-anchor="middle" class="entity-title">seller_reviews</text>
  <text x="290" y="692" class="attr pk">PK id</text>
  <text x="290" y="708" class="attr fk">FK user_id (автор)</text>
  <text x="290" y="724" class="attr fk">FK seller_id → users</text>
  <text x="290" y="740" class="attr fk">FK order_id</text>
  <text x="290" y="756" class="attr">rating, text, status</text>
  <text x="290" y="772" class="attr">created_at</text>

  <!-- conversations -->
  <rect x="580" y="220" width="240" height="198" class="entity-core" rx="6"/>
  <text x="700" y="242" text-anchor="middle" class="entity-title">conversations</text>
  <text x="590" y="262" class="attr pk">PK id</text>
  <text x="590" y="278" class="attr">type (order_chat, product_question…)</text>
  <text x="590" y="294" class="attr fk">FK buyer_id → users</text>
  <text x="590" y="310" class="attr fk">FK farmer_id → users</text>
  <text x="590" y="326" class="attr fk">FK admin_id, accountant_id</text>
  <text x="590" y="342" class="attr fk">FK order_id, product_id</text>
  <text x="590" y="358" class="attr fk">FK complaint_id</text>
  <text x="590" y="374" class="attr">status (open / resolved)</text>
  <text x="590" y="390" class="attr">created_at, updated_at</text>

  <!-- messages -->
  <rect x="880" y="250" width="200" height="148" class="entity-core" rx="6"/>
  <text x="980" y="272" text-anchor="middle" class="entity-title">messages</text>
  <text x="890" y="292" class="attr pk">PK id</text>
  <text x="890" y="308" class="attr fk">FK conversation_id</text>
  <text x="890" y="324" class="attr fk">FK sender_id → users</text>
  <text x="890" y="340" class="attr">sender_role, text</text>
  <text x="890" y="356" class="attr">attachment_path</text>
  <text x="890" y="372" class="attr">is_read, created_at</text>

  <!-- Связи (без дублирования линий к users) -->
  <path d="M210 145 L280 145" class="rel"/>
  <text x="228" y="138" class="card">1</text>
  <text x="262" y="138" class="card">N</text>

  <path d="M210 165 C245 165, 250 300, 280 310" class="rel"/>
  <text x="228" y="220" class="card">1</text>
  <text x="262" y="300" class="card">N</text>

  <path d="M210 300 L280 350" class="rel"/>
  <text x="228" y="318" class="card">1</text>
  <text x="262" y="342" class="card">N</text>

  <path d="M210 430 L280 360" class="rel"/>
  <text x="228" y="400" class="card">1</text>
  <text x="262" y="358" class="card">N</text>

  <path d="M210 175 C245 175, 250 520, 280 530" class="rel"/>
  <text x="228" y="350" class="card">1</text>
  <text x="262" y="518" class="card">N</text>

  <path d="M210 440 L280 550" class="rel"/>
  <text x="228" y="492" class="card">1</text>
  <text x="262" y="542" class="card">N</text>

  <path d="M210 185 C245 185, 250 700, 280 710" class="rel"/>
  <text x="228" y="450" class="card">1</text>
  <text x="262" y="698" class="card">N</text>

  <path d="M210 130 C400 130, 500 280, 580 300" class="rel"/>
  <text x="380" y="124" class="card">1</text>
  <text x="558" y="288" class="card">N</text>

  <path d="M210 290 C400 290, 500 330, 580 340" class="rel"/>
  <text x="380" y="284" class="card">1</text>
  <text x="558" y="328" class="card">N</text>

  <path d="M210 420 C400 420, 500 370, 580 370" class="rel"/>
  <text x="380" y="414" class="card">1</text>
  <text x="558" y="362" class="card">N</text>

  <path d="M510 360 L580 360" class="rel"/>
  <text x="528" y="352" class="card">1</text>
  <text x="558" y="352" class="card">0..1</text>

  <path d="M820 320 L880 320" class="rel"/>
  <text x="836" y="312" class="card">1</text>
  <text x="868" y="312" class="card">N</text>

  <!-- Легенда -->
  <rect x="580" y="470" width="500" height="150" class="legend-box"/>
  <text x="600" y="494" class="entity-title">Условные обозначения</text>
  <rect x="600" y="506" width="18" height="14" class="entity-core" rx="2"/>
  <text x="626" y="518" class="attr">Сущность модуля коммуникаций</text>
  <rect x="600" y="528" width="18" height="14" class="entity-ext" rx="2"/>
  <text x="626" y="540" class="attr">Связанные сущности маркетплейса</text>
  <text x="600" y="564" class="attr pk">PK</text>
  <text x="630" y="564" class="attr">— первичный ключ</text>
  <text x="600" y="582" class="attr fk">FK</text>
  <text x="630" y="582" class="attr">— внешний ключ</text>
  <text x="600" y="604" class="attr">1:N — связь «один ко многим»; доп. FK к users указаны в атрибутах сущностей</text>

  <text x="550" y="808" text-anchor="middle" class="caption">Рисунок — ER-диаграмма модуля коммуникаций и управления сообществом</text>
</svg>
'''

SVG.write_text(CONTENT, encoding="utf-8")
print(f"SVG saved: {SVG}")

# Try PNG via cairosvg, else qlmanage
try:
    import cairosvg
    cairosvg.svg2png(url=str(SVG), write_to=str(PNG), output_width=2200)
    print(f"PNG saved: {PNG}")
except Exception:
    import subprocess
    subprocess.run(
        ["qlmanage", "-t", "-s", "2200", "-o", str(SVG.parent), str(SVG)],
        check=True,
    )
    tmp = SVG.with_suffix(".svg.png")
    if tmp.exists():
        tmp.rename(PNG)
        print(f"PNG saved: {PNG}")
