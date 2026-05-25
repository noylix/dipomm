(function () {
    const h = React.createElement;
    const dataNode = document.getElementById("react-page-data");
    let props = {};
    if (dataNode) {
        try {
            props = JSON.parse(dataNode.textContent || "{}");
        } catch (err) {
            console.error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b", err);
        }
    }
    const page = window.__REACT_PAGE__ || "index";
    const user = props.user || null;
    const PRODUCT_CATEGORIES = [
        "Овощи",
        "Фрукты",
        "Ягоды",
        "Молоко",
        "Сыры",
        "Мясо",
        "Птица",
        "Яйца",
        "Мёд",
        "Хлеб",
        "Бакалея",
        "Напитки",
        "Консервы",
        "Заморозка",
        "Сладости",
        "Другое"
    ];
    const PRODUCT_UNITS = ["кг", "шт", "л", "банка", "упаковка", "пучок", "коробка"];
    const COMPLAINT_CATEGORY_LABELS = {
        payment: "\u041e\u043f\u043b\u0430\u0442\u0430",
        delivery: "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430",
        quality: "\u041a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u0442\u043e\u0432\u0430\u0440\u0430",
        order: "\u0417\u0430\u043a\u0430\u0437",
        seller: "\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446",
        buyer: "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c",
        other: "\u0414\u0440\u0443\u0433\u043e\u0435"
    };
    function money(value) {
        const number = Number(value || 0);
        return `${Math.round(number).toLocaleString("ru-RU")} \u0440\u0443\u0431`;
    }
    function dateText(value) {
        if (!value) return "";
        try {
            return new Date(value).toLocaleDateString("ru-RU");
        } catch (_) {
            return value;
        }
    }
    function orderDisplayNumber(order) {
        if (!order) return "";
        return order.order_number || `#${order.id || ""}`;
    }
    function deliveryMethodText(value) {
        return {
            courier: "\u041a\u0443\u0440\u044c\u0435\u0440",
            pickup: "\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437",
            post: "\u041f\u0443\u043d\u043a\u0442 \u0432\u044b\u0434\u0430\u0447\u0438",
            market: "\u0412\u044b\u0434\u0430\u0447\u0430 \u043d\u0430 \u0440\u044b\u043d\u043a\u0435"
        }[value] || value || "";
    }
    function deliveryPriceValue(value) {
        return ({ courier: 500, pickup: 0, post: 300, market: 150 })[value] || 0;
    }
    function paymentStatusText(value) {
        return ({ pending: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b", paid: "\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e" })[value] || value || "-";
    }
    function orderStatusText(order, labels) {
        if (order && order.status === "created" && order.payment_status === "pending") {
            return "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b";
        }
        return (labels && order && labels[order.status]) || (order && order.status) || "-";
    }
    function deliveryStatusText(order) {
        const status = order && order.status;
        return ({
            created: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b",
            paid: "\u041e\u043f\u043b\u0430\u0447\u0435\u043d, \u0436\u0434\u0435\u0442 \u0441\u0431\u043e\u0440\u043a\u0438",
            confirmed: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d",
            assembling: "\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f",
            shipped: "\u041f\u0435\u0440\u0435\u0434\u0430\u043d \u0432 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443",
            delivering: "\u0412 \u043f\u0443\u0442\u0438",
            completed: "\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d",
            canceled: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d",
            refunded: "\u0412\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d"
        })[status] || status || "-";
    }
    function logisticsStatusText(value) {
        return ({
            created: "Создана",
            accepted: "Принята логистикой",
            in_transit: "В пути",
            delivered: "Доставлена",
            manual: "Без внешней службы"
        })[value] || value || "-";
    }
    function paymentMethodText(value) {
        return {
            card_on_delivery: "\u041a\u0430\u0440\u0442\u043e\u0439 \u043f\u0440\u0438 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0438",
            cash: "\u041d\u0430\u043b\u0438\u0447\u043d\u044b\u043c\u0438 \u043f\u0440\u0438 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0438",
            yookassa: "\u042eKassa (\u043e\u043d\u043b\u0430\u0439\u043d)",
            wallet: "\u041a\u043e\u0448\u0435\u043b\u0435\u043a"
        }[value] || value || "";
    }
    function sellerApplicationStatusText(value) {
        return {
            pending: "\u041d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438",
            approved: "\u041e\u0434\u043e\u0431\u0440\u0435\u043d\u0430",
            rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0430",
        }[value] || value || "\u041d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438";
    }
    function ownerName(product) {
        const owner = product && product.owner;
        if (!owner) return "\u0424\u0435\u0440\u043c\u0435\u0440";
        return owner.farm_name || owner.full_name || "\u0424\u0435\u0440\u043c\u0435\u0440";
    }
    function stockQuantity(product) {
        if (!product) return 0;
        const raw = product.stock_quantity !== undefined && product.stock_quantity !== null ? product.stock_quantity : product.stock;
        const value = Number(raw || 0);
        return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    }
    function stockUnit(product) {
        return (product && product.unit) || "\u0448\u0442";
    }
    function lowStockThreshold(product) {
        const value = Number(product && product.low_stock_threshold || 0);
        return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    }
    function stockStatus(product) {
        const quantity = stockQuantity(product);
        if (quantity <= 0) return "out";
        if (quantity <= lowStockThreshold(product)) return "low";
        return "ok";
    }
    function stockText(product) {
        if (product && product.stock_label) return product.stock_label;
        const quantity = stockQuantity(product);
        const unit = stockUnit(product);
        if (quantity <= 0) return "\u041d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438";
        if (quantity <= lowStockThreshold(product)) return `\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c \u043c\u0430\u043b\u043e: ${quantity} ${unit}`;
        return `\u0412 \u043d\u0430\u043b\u0438\u0447\u0438\u0438: ${quantity} ${unit}`;
    }
    function canBuy(product) {
        return stockQuantity(product) > 0 && (!product || !product.status || product.status === "approved");
    }
    function productBasePrice(product) {
        if (!product) return 0;
        if (product.base_price !== undefined && product.base_price !== null) return Number(product.base_price || 0);
        return Number(product.price || 0);
    }
    function productDiscountPrice(product) {
        if (!product) return 0;
        return Number(product.discount_price || 0);
    }
    function productFinalPrice(product) {
        if (!product) return 0;
        if (product.final_price !== undefined && product.final_price !== null) return Number(product.final_price || 0);
        const base = productBasePrice(product);
        const discount = productDiscountPrice(product);
        return discount > 0 && discount < base ? discount : base;
    }
    function productHasDiscount(product) {
        if (!product) return false;
        if (product.has_discount !== undefined && product.has_discount !== null) return Boolean(product.has_discount);
        return productDiscountPrice(product) > 0 && productDiscountPrice(product) < productBasePrice(product);
    }
    function PriceDisplay({ product, compact, inline }) {
        const base = productBasePrice(product);
        const finalPrice = productFinalPrice(product);
        const hasDiscount = productHasDiscount(product);
        const content = [
            h("span", { key: "current", className: hasDiscount ? "react-price-current react-price-current-discount" : "react-price-current" }, money(finalPrice)),
            hasDiscount ? h("del", { key: "old", className: "react-price-old" }, money(base)) : null
        ];
        if (inline) return h(React.Fragment, null, content);
        return h("div", { className: `react-price-display${compact ? " compact" : ""}` }, content);
    }
    const PRODUCT_IMAGE_URLS = {
        vegetables: "https://images.unsplash.com/photo-1655558131320-b7d6d3686e8d?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000",
        fruit: "https://images.unsplash.com/photo-1759087304853-bc735537640c?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000",
        eggs: "https://images.unsplash.com/photo-1518476381266-33596bddffc0?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000",
        honey: "https://images.unsplash.com/photo-1668510468038-3607aae3f03c?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000",
        bread: "https://images.unsplash.com/photo-1756244389018-ebf8169a0ed3?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000",
        dairy: "https://unsplash.com/photos/IfgP8D3Wye8/download?force=true",
        cheese: "https://unsplash.com/photos/3PHZi-5wKiI/download?force=true",
        meat: "https://unsplash.com/photos/raw-meat-DxJvLtab4ak/download?force=true"
    };
    function normalizeText(value) {
        return (value || "").toString().toLowerCase();
    }
    function fallbackProductImage(product) {
        const name = normalizeText(product && product.name);
        const category = normalizeText(product && product.category);
        if (name.includes("\u043c\u043e\u043b") || name.includes("\u043a\u0435\u0444\u0438\u0440") || name.includes("\u0441\u043c\u0435\u0442\u0430\u043d") || name.includes("\u0442\u0432\u043e\u0440\u043e\u0433") || category.includes("\u043c\u043e\u043b")) {
            return PRODUCT_IMAGE_URLS.dairy;
        }
        if (name.includes("\u0441\u044b\u0440")) {
            return PRODUCT_IMAGE_URLS.cheese;
        }
        if (name.includes("\u044f\u0439\u0446") || category.includes("\u044f\u0439\u0446")) {
            return PRODUCT_IMAGE_URLS.eggs;
        }
        if (name.includes("\u043c\u0435\u0434") || name.includes("\u043c\u0451\u0434") || category.includes("\u043c\u0451\u0434")) {
            return PRODUCT_IMAGE_URLS.honey;
        }
        if (name.includes("\u0445\u043b\u0435\u0431") || name.includes("\u0431\u0443\u043b\u043e\u0447") || category.includes("\u0445\u043b\u0435\u0431")) {
            return PRODUCT_IMAGE_URLS.bread;
        }
        if (category.includes("\u0444\u0440\u0443\u043a\u0442") || name.includes("\u044f\u0431\u043b") || name.includes("\u0433\u0440\u0443\u0448") || name.includes("\u0441\u043b\u0438\u0432") || name.includes("\u0432\u0438\u043d\u043e\u0433\u0440") || name.includes("\u044f\u0433\u043e\u0434") || name.includes("\u043a\u043b\u0443\u0431")) {
            return PRODUCT_IMAGE_URLS.fruit;
        }
        if (category.includes("\u043c\u044f\u0441") || name.includes("\u043c\u044f\u0441") || name.includes("\u043a\u043e\u043b\u0431\u0430\u0441") || name.includes("\u0441\u043e\u0441\u0438\u0441") || name.includes("\u0440\u044b\u0431") || name.includes("\u043a\u0443\u0440\u0438\u0446") || name.includes("\u0433\u043e\u0432\u044f") || name.includes("\u0441\u0432\u0438\u043d")) {
            return PRODUCT_IMAGE_URLS.meat;
        }
        if (category.includes("\u043e\u0432\u043e\u0449") || name.includes("\u043f\u043e\u043c\u0438\u0434") || name.includes("\u0442\u043e\u043c\u0430\u0442") || name.includes("\u043e\u0433\u0443\u0440") || name.includes("\u043a\u0430\u0440\u0442\u043e") || name.includes("\u043c\u043e\u0440\u043a\u043e\u0432") || name.includes("\u043a\u0430\u043f\u0443\u0441\u0442") || name.includes("\u0441\u0432\u0435\u043a\u043b") || name.includes("\u0433\u0440\u0438\u0431")) {
            return PRODUCT_IMAGE_URLS.vegetables;
        }
        if (category.includes("\u0441\u043b\u0430\u0434") || name.includes("\u0441\u043b\u0430\u0434")) {
            return PRODUCT_IMAGE_URLS.fruit;
        }
        return PRODUCT_IMAGE_URLS.vegetables;
    }
    function productImage(product) {
        if (product && product.image_url) return product.image_url;
        return fallbackProductImage(product);
    }
    function productIconName(product) {
        const name = ((product && product.name) || "").toLowerCase();
        const category = ((product && product.category) || "").toLowerCase();
        if (name.includes("мол") || category.includes("мол")) return "milk";
        if (name.includes("яйц")) return "egg";
        if (name.includes("мед") || name.includes("мёд")) return "hexagon";
        if (name.includes("ягод") || name.includes("клуб") || name.includes("малин") || name.includes("черник")) return "cherry";
        if (name.includes("ябл") || name.includes("груш") || category.includes("фрукт")) return "apple";
        if (name.includes("мяс") || name.includes("колбас") || category.includes("мяс")) return "beef";
        if (category.includes("овощ") || name.includes("карто") || name.includes("морков")) return "carrot";
        return "package";
    }
    function ProductPlaceholder({ product, compact }) {
        return h("div", { className: `react-product-placeholder${compact ? " compact" : ""}` }, [
            h("span", { key: "glyph", className: "react-product-placeholder-icon" }, Icon({ name: productIconName(product) })),
            h("small", { key: "text" }, (product && product.category) || "\u0424\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0438\u0439 \u043f\u0440\u043e\u0434\u0443\u043a\u0442")
        ]);
    }
    function ProductMedia({ product, className, compact }) {
        const primary = product && product.image_url ? product.image_url : "";
        const fallback = fallbackProductImage(product);
        const [stage, setStage] = React.useState(primary ? "primary" : "fallback");
        React.useEffect(() => {
            setStage(primary ? "primary" : "fallback");
        }, [primary, product && product.id]);
        const src = stage === "primary" ? primary : fallback;
        const handleError = () => {
            if (stage === "primary" && fallback && fallback !== primary) {
                setStage("fallback");
            } else {
                setStage("placeholder");
            }
        };
        return src && stage !== "placeholder"
            ? h("img", { src, alt: (product && product.name) || "", loading: "lazy", onError: handleError, className: className || "" })
            : h(ProductPlaceholder, { product, compact });
    }
    const SMART_PRODUCT_GROUPS = {
        "\u043c\u043e\u043b\u043e\u0447\u043a\u0430": ["\u043c\u043e\u043b\u043e\u043a\u043e", "\u0441\u044b\u0440", "\u0442\u0432\u043e\u0440\u043e\u0433", "\u0441\u043c\u0435\u0442\u0430\u043d\u0430", "\u043a\u0435\u0444\u0438\u0440"],
        "\u043e\u0432\u043e\u0449\u0438": ["\u043f\u043e\u043c\u0438\u0434\u043e\u0440\u044b", "\u043e\u0433\u0443\u0440\u0446\u044b", "\u043a\u0430\u0440\u0442\u043e\u0444\u0435\u043b\u044c", "\u043c\u043e\u0440\u043a\u043e\u0432\u044c", "\u043a\u0430\u043f\u0443\u0441\u0442\u0430", "\u0437\u0435\u043b\u0435\u043d\u044c"],
        "\u0444\u0440\u0443\u043a\u0442\u044b": ["\u044f\u0431\u043b\u043e\u043a\u0438", "\u0433\u0440\u0443\u0448\u0438", "\u0441\u043b\u0438\u0432\u044b", "\u044f\u0433\u043e\u0434\u044b", "\u043a\u043b\u0443\u0431\u043d\u0438\u043a\u0430", "\u043c\u0430\u043b\u0438\u043d\u0430"],
        "\u043a \u0447\u0430\u044e": ["\u043c\u0435\u0434", "\u0432\u0430\u0440\u0435\u043d\u044c\u0435", "\u0432\u044b\u043f\u0435\u0447\u043a\u0430", "\u043f\u0435\u0447\u0435\u043d\u044c\u0435", "\u044f\u0433\u043e\u0434\u044b", "\u0445\u043b\u0435\u0431"],
        "\u0437\u0430\u0432\u0442\u0440\u0430\u043a": ["\u044f\u0439\u0446\u0430", "\u043c\u043e\u043b\u043e\u043a\u043e", "\u0441\u044b\u0440", "\u0442\u0432\u043e\u0440\u043e\u0433", "\u0445\u043b\u0435\u0431"],
        "\u043f\u043e\u043b\u0435\u0437\u043d\u043e\u0435 \u043f\u0438\u0442\u0430\u043d\u0438\u0435": ["\u043e\u0432\u043e\u0449\u0438", "\u0444\u0440\u0443\u043a\u0442\u044b", "\u0437\u0435\u043b\u0435\u043d\u044c", "\u043c\u0435\u0434", "\u0442\u0432\u043e\u0440\u043e\u0433"],
        "\u0444\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0438\u0435 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u044b": ["\u043c\u043e\u043b\u043e\u043a\u043e", "\u0441\u044b\u0440", "\u044f\u0439\u0446\u0430", "\u043c\u0435\u0434", "\u0445\u043b\u0435\u0431", "\u043e\u0432\u043e\u0449\u0438", "\u0444\u0440\u0443\u043a\u0442\u044b"]
    };
    function getSimilarProducts(currentProduct, allProducts) {
        const base = currentProduct || {};
        const currentText = normalizeText([
            base.name,
            base.category,
            base.description,
            base.variety,
            base.region,
            ownerName(base)
        ].filter(Boolean).join(" "));
        const tokens = currentText.split(/[^a-z\u0430-\u044f0-9]+/g).filter(Boolean);
        const keywordSet = new Set();
        tokens.forEach(token => {
            Object.entries(SMART_PRODUCT_GROUPS).forEach(([key, values]) => {
                if (token.includes(key) || key.includes(token)) {
                    values.forEach(value => keywordSet.add(value));
                }
                values.forEach(value => {
                    if (token.includes(value) || value.includes(token)) {
                        keywordSet.add(value);
                    }
                });
            });
        });
        return (allProducts || [])
            .filter(product => product && product.id !== base.id)
            .map(product => {
                let score = 0;
                const productText = normalizeText([
                    product.name,
                    product.category,
                    product.description,
                    product.variety,
                    product.region,
                    ownerName(product)
                ].filter(Boolean).join(" "));
                if (product.category && base.category && normalizeText(product.category) === normalizeText(base.category)) score += 3;
                if (product.owner_id && base.owner_id && product.owner_id === base.owner_id) score += 2;
                if (Math.abs(productFinalPrice(product) - productFinalPrice(base)) <= 50) score += 2;
                else if (Math.abs(productFinalPrice(product) - productFinalPrice(base)) <= 100) score += 1;
                if (product.variety && base.variety && normalizeText(product.variety) === normalizeText(base.variety)) score += 1;
                keywordSet.forEach(keyword => {
                    if (productText.includes(keyword)) score += 1;
                });
                return { ...product, score };
            })
            .filter(product => product.score > 0)
            .sort((a, b) => b.score - a.score || Number(b.id || 0) - Number(a.id || 0))
            .slice(0, 4);
    }
    function ProductMiniPreview({ product }) {
        if (!product) return null;
        return h("div", { className: "react-product-mini" }, [
            A({ key: "img", href: `/product/${product.id}`, className: "react-product-mini-image" }, h(ProductMedia, { product, compact: true })),
            h("div", { key: "body", className: "react-product-mini-body" }, [
                A({ key: "name", href: `/product/${product.id}`, className: "react-product-mini-name" }, product.name),
                h("div", { key: "meta", className: "react-muted react-product-mini-meta" }, [
                    product.category ? `${product.category} \u00b7 ` : "",
                    h(PriceDisplay, { product, compact: true, inline: true })
                ])
            ])
        ]);
    }
    function A(props, children) {
        return h("a", props, children);
    }
    function handleSubmitOnce(event) {
        const form = event.currentTarget;
        if (form.dataset.submitted === "true") {
            event.preventDefault();
            return false;
        }
        if (form.checkValidity && !form.checkValidity()) {
            return true;
        }
        form.dataset.submitted = "true";
        window.setTimeout(() => {
            form.querySelectorAll("button, input[type='submit']").forEach(control => {
                control.disabled = true;
                control.classList.add("is-loading");
            });
        }, 0);
        return true;
    }
    function confirmSubmit(message) {
        return event => {
            if (!window.confirm(message)) {
                event.preventDefault();
                return false;
            }
            return handleSubmitOnce(event);
        };
    }
    function PostButton({ action, children, className, title, ariaLabel, icon, confirmMessage, formClassName, formProps }) {
        return h(
            "form",
            {
                action,
                method: "post",
                className: `react-inline-form ${formClassName || ""}`,
                onSubmit: confirmMessage ? confirmSubmit(confirmMessage) : handleSubmitOnce,
                ...(formProps || {})
            },
            h(
                "button",
                { type: "submit", className: className || "react-btn", title, "aria-label": ariaLabel || title },
                icon ? Icon({ name: icon }) : children
            )
        );
    }
    function CancelOrderButton({ action, children }) {
        const [open, setOpen] = React.useState(false);
        const formRef = React.useRef(null);
        const submitCancel = () => {
            if (!formRef.current) return;
            formRef.current.dataset.submitted = "true";
            formRef.current.submit();
        };
        return h(React.Fragment, null, [
            h("form", {
                key: "cancel-form",
                ref: formRef,
                action,
                method: "post",
                className: "react-inline-form",
                onSubmit: event => {
                    event.preventDefault();
                    setOpen(true);
                }
            }, h("button", { type: "submit", className: "react-btn danger" }, children || "Отменить заказ")),
            h(ConfirmDialog, {
                key: "cancel-dialog",
                open,
                title: "Отменить заказ",
                text: "Вы уверены, что хотите отменить этот заказ?",
                onCancel: () => setOpen(false),
                onConfirm: submitCancel,
                cancelLabel: "Оставить",
                confirmLabel: "Отменить заказ",
                confirmClassName: "react-btn danger"
            })
        ]);
    }
    function ButtonLink({ href, children, className, key }, fallbackChildren) {
        return A({ key, href, className: `react-btn ${className || ""}` }, children || fallbackChildren);
    }
    function iconName(title) {
        const map = {
            "\u041a\u043e\u0440\u0437\u0438\u043d\u0430": "shopping-cart",
            "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435": "heart",
            "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f": "bell",
            "\u041a\u043e\u0448\u0435\u043b\u0435\u043a": "wallet",
            "\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b": "clipboard-list",
            "\u0410\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c": "settings",
            "\u041a\u0430\u0431\u0438\u043d\u0435\u0442 \u0444\u0435\u0440\u043c\u0435\u0440\u0430": "sprout",
            "\u0412\u044b\u0439\u0442\u0438": "log-out",
            "\u0412\u043e\u0439\u0442\u0438": "log-in"
        };
        return map[title] || "circle";
    }
    function refreshIcons() {
        if (window.lucide) {
            window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
        }
    }
    function sellerLink(product) {
        const ownerId = product && (product.owner_id || (product.owner && product.owner.id));
        return ownerId ? `/seller/${ownerId}` : null;
    }
    function Icon({ name }) {
        return h("i", { "data-lucide": name, "aria-hidden": "true" });
    }
    function IconLink({ href, title, key, onClick }) {
        return A(
            {
                key,
                href,
                title,
                "aria-label": title,
                className: "react-icon-btn",
                onClick
            },
            Icon({ name: iconName(title) })
        );
    }
    function NotificationsLink() {
        const [count, setCount] = React.useState(0);
        React.useEffect(() => {
            let alive = true;
            if (!window.fetch) return () => {};
            fetch("/notifications/unread-count", { credentials: "same-origin" })
                .then(response => response.ok ? response.json() : { count: 0 })
                .then(data => {
                    if (alive) setCount(Number((data && data.count) || 0));
                })
                .catch(() => {
                    if (alive) setCount(0);
                });
            return () => {
                alive = false;
            };
        }, []);
        return A(
            { href: "/notifications/", title: "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", "aria-label": "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f", className: "react-icon-btn react-icon-btn-badge" },
            [
                Icon({ key: "icon", name: iconName("\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f") }),
                count > 0 ? h("span", { key: "badge", className: "react-counter-badge" }, count > 99 ? "99+" : String(count)) : null
            ]
        );
    }
    function Field({ name, type, placeholder, defaultValue, required, className, min, max, step, minLength, maxLength, pattern, title, onChange }) {
        return h("input", { className: `react-input ${className || ""}`, name, type: type || "text", placeholder, defaultValue: defaultValue || "", required, min, max, step, minLength, maxLength, pattern, title, onChange });
    }
    function Select({ name, defaultValue, value, onChange, children, className }) {
        const selectProps = { className: `react-select ${className || ""}`, name };
        if (value !== undefined) {
            selectProps.value = value;
        } else {
            selectProps.defaultValue = defaultValue || "";
        }
        if (onChange) {
            selectProps.onChange = onChange;
        }
        return h("select", selectProps, children);
    }
    function Textarea({ name, placeholder, defaultValue, className, rows, required, minLength, maxLength }) {
        return h("textarea", { className: `react-textarea ${className || ""}`, name, placeholder, defaultValue: defaultValue || "", rows: rows || 4, required, minLength, maxLength });
    }
    function SearchBox() {
        const [query, setQuery] = React.useState(props.q || "");
        const [suggestions, setSuggestions] = React.useState([]);
        const [opened, setOpened] = React.useState(false);
        React.useEffect(() => {
            const value = (query || "").trim();
            if (value.length < 2) {
                setSuggestions([]);
                return;
            }
            let alive = true;
            const timer = window.setTimeout(() => {
                fetch(`/api/search/suggestions?q=${encodeURIComponent(value)}`, { credentials: "same-origin" })
                    .then(response => response.ok ? response.json() : { suggestions: [] })
                    .then(data => {
                        if (!alive) return;
                        const next = [];
                        if (data.corrected_query) next.push(data.corrected_query);
                        (data.suggestions || []).forEach(item => {
                            if (item && !next.includes(item)) next.push(item);
                        });
                        setSuggestions(next.slice(0, 8));
                    })
                    .catch(() => {
                        if (alive) setSuggestions([]);
                    });
            }, 180);
            return () => {
                alive = false;
                window.clearTimeout(timer);
            };
        }, [query]);
        return h("div", { className: "react-search-box" }, [
            h("input", {
                key: "q",
                className: "react-input",
                name: "q",
                placeholder: "\u041f\u043e\u0438\u0441\u043a...",
                value: query,
                autoComplete: "off",
                onChange: event => {
                    setQuery(event.target.value);
                    setOpened(true);
                },
                onFocus: () => setOpened(true),
                onBlur: () => window.setTimeout(() => setOpened(false), 120)
            }),
            opened && suggestions.length ? h("div", { className: "react-search-suggestions" }, suggestions.map(item =>
                A({ key: item, href: `/search?q=${encodeURIComponent(item)}`, className: "react-search-suggestion" }, item)
            )) : null
        ]);
    }
    function Header({ onLogoutRequest, onBecomeSellerRequest }) {
        const [catalogOpen, setCatalogOpen] = React.useState(false);
        const catalogCategories = [
            { key: "vegetables", label: "\u041e\u0432\u043e\u0449\u0438", href: "/catalog?category=\u043e\u0432\u043e\u0449\u0438" },
            { key: "fruit", label: "\u0424\u0440\u0443\u043a\u0442\u044b", href: "/catalog?category=\u0444\u0440\u0443\u043a\u0442\u044b" },
            { key: "dairy", label: "\u041c\u043e\u043b\u043e\u0447\u043d\u043e\u0435", href: "/catalog?category=\u043c\u043e\u043b\u043e\u043a\u043e" },
            { key: "meat", label: "\u041c\u044f\u0441\u043e", href: "/catalog?category=\u043c\u044f\u0441\u043e" },
            { key: "eggs", label: "\u042f\u0439\u0446\u0430", href: "/catalog?category=\u044f\u0439\u0446\u0430" },
            { key: "honey", label: "\u041c\u0435\u0434", href: "/catalog?category=\u043c\u0451\u0434" },
            { key: "bread", label: "\u0425\u043b\u0435\u0431 \u0438 \u0432\u044b\u043f\u0435\u0447\u043a\u0430", href: "/catalog?category=\u0445\u043b\u0435\u0431" },
            { key: "greens", label: "\u0417\u0435\u043b\u0435\u043d\u044c", href: "/catalog?category=\u043e\u0432\u043e\u0449\u0438" }
        ];
        React.useEffect(() => {
            if (!catalogOpen) return undefined;
            const close = () => setCatalogOpen(false);
            window.addEventListener("click", close);
            return () => window.removeEventListener("click", close);
        }, [catalogOpen]);
        return h("div", { className: "react-topbar" },
            h("header", { className: "react-header wrap" },
                A({ href: "/", className: "react-logo" }, [
                    h("strong", { key: "t" }, "\u0421\u0412\u041e\u0418 \u0420\u042f\u0414\u042b"),
                    h("span", { key: "s" }, "\u041b\u044e\u0431\u0438\u043c \u0441 \u043f\u043e\u043b\u044c\u0437\u043e\u0439")
                ]),
                h("nav", { className: "react-nav" }, [
                    A({ key: "about", href: "/about" }, "\u041e \u043d\u0430\u0441"),
                    A({ key: "delivery", href: "/delivery" }, "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"),
                    A({ key: "seller", href: "/become-seller", onClick: onBecomeSellerRequest }, "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c"),
                    A({ key: "business", href: "/business" }, "\u0414\u043b\u044f \u0431\u0438\u0437\u043d\u0435\u0441\u0430")
                ]),
                h("div", { className: "react-actions" }, [
                    (!user || ["user", "seller"].includes(user.role)) && IconLink({ key: "cart", href: "/cart/", title: "\u041a\u043e\u0440\u0437\u0438\u043d\u0430" }),
                    user && ["user", "seller"].includes(user.role) && IconLink({ key: "fav", href: "/favorites/", title: "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435" }),
                    user && ["user", "seller"].includes(user.role) && IconLink({ key: "profile", href: "/profile", title: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c" }),
                    user && ["user", "seller"].includes(user.role) && h(NotificationsLink, { key: "nt" }),
                    user && ["user", "seller"].includes(user.role) && IconLink({ key: "wl", href: "/payment/wallet", title: "\u041a\u043e\u0448\u0435\u043b\u0435\u043a" }),
                    user && ["admin"].includes(user.role) && IconLink({ key: "adm", href: "/admin/", title: "\u0410\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c" }),
                    user && ["accountant"].includes(user.role) && IconLink({ key: "acc", href: "/accounting/", title: "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f" }),
                    user && user.role === "seller" && IconLink({ key: "sell", href: "/seller/", title: "\u041a\u0430\u0431\u0438\u043d\u0435\u0442 \u0444\u0435\u0440\u043c\u0435\u0440\u0430" }),
                    user ? IconLink({ key: "out", href: "/logout", title: "\u0412\u044b\u0439\u0442\u0438", onClick: onLogoutRequest }) : IconLink({ key: "in", href: "/login", title: "\u0412\u043e\u0439\u0442\u0438" })
                ])
            ),
            h("form", { action: "/search", method: "get", className: "react-search wrap" }, [
                h("button", {
                    key: "catalog",
                    type: "button",
                    className: "react-btn",
                    onClick: event => {
                        event.stopPropagation();
                        setCatalogOpen(open => !open);
                    }
                }, "\u041a\u0430\u0442\u0430\u043b\u043e\u0433"),
                h(SearchBox, { key: "searchbox" }),
                h("button", { key: "submit", className: "react-btn", type: "submit" }, "\u041d\u0430\u0439\u0442\u0438")
            ]),
            catalogOpen ? h("div", { className: "react-catalog-drawer wrap", onClick: event => event.stopPropagation() }, [
                h("div", { className: "react-catalog-grid" }, catalogCategories.map(category =>
                    A({ key: category.key, href: category.href, className: "react-catalog-item", onClick: () => setCatalogOpen(false) }, category.label)
                ))
            ]) : null
        );
    }
    function Footer() {
        return h("footer", { className: "react-footer" },
            h("div", { className: "react-footer-inner wrap" }, [
                h("div", { key: "brand" }, [h("h4", null, "\u0421\u0432\u043e\u0438 \u0420\u044f\u0434\u044b"), h("p", null, "\u0424\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0438\u0435 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u044b, \u043f\u0440\u043e\u0432\u0435\u0440\u0435\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u044b \u0438 \u043f\u043e\u043d\u044f\u0442\u043d\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430.")]),
                h("div", { key: "clients" }, [h("h4", null, "\u041a\u043b\u0438\u0435\u043d\u0442\u0430\u043c"), A({ href: "/delivery" }, "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"), A({ href: "/reviews" }, "\u041e\u0442\u0437\u044b\u0432\u044b"), A({ href: "/quality" }, "\u041a\u0430\u0447\u0435\u0441\u0442\u0432\u043e"), A({ href: "/bonus" }, "\u0411\u043e\u043d\u0443\u0441\u044b")]),
                h("div", { key: "company" }, [h("h4", null, "\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u044f"), A({ href: "/about" }, "\u041e \u043d\u0430\u0441"), A({ href: "/blog" }, "\u0411\u043b\u043e\u0433"), A({ href: "/recipes" }, "\u0420\u0435\u0446\u0435\u043f\u0442\u044b")]),
                h("div", { key: "phone" }, [h("h4", null, "8-906-440-29-35"), h("p", null, "\u0415\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u043e \u0441 8 \u0434\u043e 21")])
            ])
        );
    }
    function AdminShell({ children, onLogoutRequest }) {
        return h("div", { className: "react-shell" }, [
            h("div", { key: "top", className: "react-admin-top" },
                h("div", { className: "react-admin-head wrap" }, [
                    A({ key: "logo", href: "/admin/", className: "react-logo" }, [h("strong", null, "\u0421\u0412\u041e\u0418 \u0420\u042f\u0414\u042b"), h("span", null, "\u041f\u0430\u043d\u0435\u043b\u044c \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f")]),
                    h("nav", { key: "nav", className: "react-admin-nav" }, [
                        A({ href: "/admin/" }, "\u0413\u043b\u0430\u0432\u043d\u0430\u044f"),
                        A({ href: "/reviews/admin" }, "\u041e\u0442\u0437\u044b\u0432\u044b"),
                        A({ href: "/complaints/admin" }, "\u0416\u0430\u043b\u043e\u0431\u044b"),
                        A({ href: "/notifications/admin" }, "\u0420\u0430\u0441\u0441\u044b\u043b\u043a\u0438"),
                        A({ href: "/admin/analytics/" }, "\u041e\u0442\u0447\u0435\u0442\u044b"),
                        A({ href: "/admin/moderation" }, "\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f"),
                        A({ href: "/admin/manage" }, "\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435"),
                        A({ href: "/logout", onClick: onLogoutRequest }, "\u0412\u044b\u0439\u0442\u0438")
                    ])
                ])
            ),
            h("main", { key: "main", className: "react-main react-page wrap" }, children)
        ]);
    }
    function SellerShell({ children, onLogoutRequest }) {
        return h("div", { className: "react-shell" }, [
            h("div", { key: "top", className: "react-admin-top" },
                h("div", { className: "react-admin-head wrap" }, [
                    A({ key: "logo", href: "/seller/", className: "react-logo" }, [h("strong", null, "\u0421\u0412\u041e\u0418 \u0420\u042f\u0414\u042b"), h("span", null, "\u041a\u0430\u0431\u0438\u043d\u0435\u0442 \u0444\u0435\u0440\u043c\u0435\u0440\u0430")]),
                    h("nav", { key: "nav", className: "react-admin-nav" }, [
                        A({ href: "/seller/" }, "\u041a\u0430\u0431\u0438\u043d\u0435\u0442"),
                        A({ href: "/seller/orders" }, "\u0417\u0430\u043a\u0430\u0437\u044b"),
                        A({ href: "/conversations/?kind=order_chat" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u043f\u043e \u0437\u0430\u043a\u0430\u0437\u0430\u043c"),
                        A({ href: "/conversations/?kind=product_question" }, "\u0412\u043e\u043f\u0440\u043e\u0441\u044b \u043f\u043e \u0442\u043e\u0432\u0430\u0440\u0430\u043c"),
                        A({ href: "/seller/support" }, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430"),
                        A({ href: "/seller/settings" }, "\u041f\u0440\u043e\u0444\u0438\u043b\u044c"),
                        A({ href: "/logout", onClick: onLogoutRequest }, "\u0412\u044b\u0439\u0442\u0438")
                    ])
                ])
            ),
            h("main", { key: "main", className: "react-main react-page wrap" }, children)
        ]);
    }
    function ConfirmDialog({ open, title, text, onCancel, onConfirm, cancelLabel, confirmLabel, confirmClassName }) {
        React.useEffect(() => {
            if (!open) return undefined;
            const handleKeyDown = event => {
                if (event.key === "Escape") onCancel();
            };
            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }, [open, onCancel]);
        if (!open) return null;
        return h("div", { className: "react-modal-overlay", onClick: onCancel }, [
            h("div", {
                key: "dialog",
                className: "react-modal",
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": "logout-confirm-title",
                onClick: event => event.stopPropagation()
            }, [
                h("h3", { key: "title", id: "logout-confirm-title", className: "react-modal-title" }, title),
                h("p", { key: "text", className: "react-modal-text" }, text),
                h("div", { key: "actions", className: "react-modal-actions" }, [
                    h("button", { key: "cancel", type: "button", className: "react-btn secondary", onClick: onCancel }, cancelLabel || "\u041e\u0441\u0442\u0430\u0442\u044c\u0441\u044f"),
                    h("button", { key: "confirm", type: "button", className: confirmClassName || "react-btn danger", onClick: onConfirm }, confirmLabel || "\u0412\u044b\u0439\u0442\u0438")
                ])
            ])
        ]);
    }
    function NoticeDialog({ open, title, text, onClose }) {
        React.useEffect(() => {
            if (!open) return undefined;
            const handleKeyDown = event => {
                if (event.key === "Escape") onClose();
            };
            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }, [open, onClose]);
        if (!open) return null;
        return h("div", { className: "react-modal-overlay", onClick: onClose }, [
            h("section", {
                key: "dialog",
                className: "react-modal",
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": "notice-dialog-title",
                onClick: event => event.stopPropagation()
            }, [
                h("h3", { key: "title", id: "notice-dialog-title", className: "react-modal-title" }, title),
                h("p", { key: "text", className: "react-modal-text" }, text),
                h("div", { key: "actions", className: "react-modal-actions" }, [
                    h("button", { key: "close", type: "button", className: "react-btn", onClick: onClose }, "\u041f\u043e\u043d\u044f\u0442\u043d\u043e")
                ])
            ])
        ]);
    }
    function SellerApplicationForm({ compact }) {
        const [previewUrl, setPreviewUrl] = React.useState(props.passport_photo_url || "");
        const [passportError, setPassportError] = React.useState("");
        const [submitting, setSubmitting] = React.useState(false);
        React.useEffect(() => {
            return () => {
                if (previewUrl && previewUrl.startsWith("blob:")) {
                    URL.revokeObjectURL(previewUrl);
                }
            };
        }, [previewUrl]);
        function handlePassportChange(event) {
            const file = event.target.files && event.target.files[0];
            if (previewUrl && previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrl);
            }
            if (!file) {
                setPreviewUrl("");
                setPassportError("");
                return;
            }
            if (!file.type.startsWith("image/")) {
                event.target.value = "";
                setPreviewUrl("");
                setPassportError("\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430.");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                event.target.value = "";
                setPreviewUrl("");
                setPassportError("\u0424\u0430\u0439\u043b \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430 \u043d\u0435 \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 5 \u041c\u0411.");
                return;
            }
            setPassportError("");
            setPreviewUrl(URL.createObjectURL(file));
        }
        function handleSellerSubmit(event) {
            if (passportError) {
                event.preventDefault();
                return false;
            }
            setSubmitting(true);
            return handleSubmitOnce(event);
        }
        return h("form", { action: "/become-seller", method: "post", encType: "multipart/form-data", className: compact ? "react-stack" : "react-form-grid", onSubmit: handleSellerSubmit }, [
            Field({ name: "email", type: "email", placeholder: "Email", defaultValue: props.email, required: true }),
            Field({ name: "password", type: "password", placeholder: "\u041f\u0430\u0440\u043e\u043b\u044c", required: true, minLength: 6 }),
            Field({ name: "full_name", placeholder: "\u0418\u043c\u044f \u0438 \u0444\u0430\u043c\u0438\u043b\u0438\u044f", defaultValue: props.full_name, required: true, maxLength: 255 }),
            Field({ name: "farm_name", placeholder: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0444\u0435\u0440\u043c\u044b", defaultValue: props.farm_name, required: true, maxLength: 255 }),
            Field({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: props.phone, required: true, maxLength: 50 }),
            Field({ name: "inn", placeholder: "\u0418\u041d\u041d", defaultValue: props.inn, required: true, pattern: "\\d{10}|\\d{12}", title: "\u0418\u041d\u041d \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c 10 \u0438\u043b\u0438 12 \u0446\u0438\u0444\u0440" }),
            Field({ name: "supplier_registration_data", placeholder: "\u0415\u0413\u0420\u0418\u041f/\u0415\u0413\u0420\u042e\u041b \u0438\u043b\u0438 \u0434\u0430\u043d\u043d\u044b\u0435 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438", defaultValue: props.supplier_registration_data, required: true, maxLength: 1000 }),
            Field({ name: "supplier_bank_details", placeholder: "\u0420\u0435\u043a\u0432\u0438\u0437\u0438\u0442\u044b \u0434\u043b\u044f \u0432\u044b\u043f\u043b\u0430\u0442", defaultValue: props.supplier_bank_details, maxLength: 1000 }),
            Field({ name: "farm_address", placeholder: "\u0420\u0435\u0433\u0438\u043e\u043d \u0438\u043b\u0438 \u0430\u0434\u0440\u0435\u0441 \u0444\u0435\u0440\u043c\u044b", defaultValue: props.farm_address, className: compact ? "" : "wide", required: true, maxLength: 500 }),
            Textarea({ name: "farm_description", placeholder: "\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0444\u0435\u0440\u043c\u0443, \u043f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u044e \u0438 \u0443\u0441\u043b\u043e\u0432\u0438\u044f \u0440\u0430\u0431\u043e\u0442\u044b", defaultValue: props.farm_description, className: compact ? "" : "wide", rows: compact ? 4 : 5, maxLength: 2000 }),
            h("div", { className: compact ? "react-stack" : "wide react-stack" }, [
                h("label", { className: "react-muted" }, "\u0424\u043e\u0442\u043e \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430"),
                h("input", { name: "passport_photo", type: "file", className: "react-input", accept: "image/*", onChange: handlePassportChange }),
                h("small", { className: "react-muted" }, "\u0424\u0430\u0439\u043b \u0434\u043e 5 \u041c\u0411, JPG/PNG/WEBP."),
                previewUrl ? h("img", { src: previewUrl, alt: "\u041f\u0440\u0435\u0432\u044c\u044e \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430", className: "react-passport-preview" }) : null,
                (passportError || props.error) ? h("p", { className: "alert alert-danger" }, passportError || props.error) : null
            ]),
            h("div", { className: compact ? "react-stack" : "wide react-stack" }, [
                h("label", { className: "react-muted" }, "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430"),
                h("input", { name: "supplier_document", type: "file", className: "react-input", accept: "image/*,application/pdf" }),
                h("small", { className: "react-muted" }, "\u0414\u043e\u0433\u043e\u0432\u043e\u0440 \u0443\u0447\u0438\u0442\u044b\u0432\u0430\u0435\u0442 \u0433\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u0443\u044e \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044e \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b 7% \u0441 \u043a\u0430\u0436\u0434\u043e\u0439 \u043f\u0440\u043e\u0434\u0430\u0436\u0438.")
            ]),
            h("button", { className: compact ? "react-btn" : "react-btn wide", type: "submit", disabled: submitting || Boolean(passportError) }, submitting ? "\u0418\u0434\u0435\u0442 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0430..." : "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443")
        ]);
    }
    function SellerSignupModal({ open, onClose }) {
        React.useEffect(() => {
            if (!open) return undefined;
            const handleKeyDown = event => {
                if (event.key === "Escape") onClose();
            };
            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }, [open, onClose]);
        if (!open) return null;
        return h("div", { className: "react-modal-overlay", onClick: onClose }, [
            h("section", {
                key: "dialog",
                className: "react-modal react-modal-wide",
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": "seller-signup-title",
                onClick: event => event.stopPropagation()
            }, [
                h("div", { key: "head", className: "react-page-title" }, [
                    h("h2", { id: "seller-signup-title" }, "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c"),
                    h("button", { type: "button", className: "react-btn secondary", onClick: onClose }, "\u0417\u0430\u043a\u0440\u044b\u0442\u044c")
                ]),
                h("p", { className: "react-modal-text" }, "\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0430\u043d\u043a\u0435\u0442\u0443 \u0444\u0435\u0440\u043c\u0435\u0440\u0430. \u041f\u043e\u0441\u043b\u0435 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u044f \u0430\u0434\u043c\u0438\u043d\u043e\u043c \u0432\u044b \u0441\u043c\u043e\u0436\u0435\u0442\u0435 \u0432\u043e\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 \u043e\u0431\u044b\u0447\u043d\u043e\u0435 \u043e\u043a\u043d\u043e \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438."),
                props.error && page === "become_seller" ? h("p", { className: "alert alert-danger" }, props.error) : null,
                h(SellerApplicationForm, { compact: false })
            ])
        ]);
    }
    function Shell({ children, onLogoutRequest, onBecomeSellerRequest, logoutConfirm, closeLogoutConfirm, confirmLogout, sellerSignupOpen, closeSellerSignup, noticeMessage, closeNotice }) {
        if (page === "accounting" || page === "accounting_order") {
            return h("div", { className: "react-shell" }, [
                h("main", { key: "m", className: "react-main react-page wrap" }, children),
                h(ConfirmDialog, {
                    key: "logout-dialog",
                    open: Boolean(logoutConfirm),
                    title: "\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430",
                    text: "\u0412\u044b \u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441\u0435\u0441\u0441\u0438\u044e?",
                    onCancel: closeLogoutConfirm,
                    onConfirm: confirmLogout
                })
            ]);
        }
        const showGlobalNotice = Boolean(noticeMessage) && page !== "seller_pending";
        if (user && user.role === "accountant") {
            return h("div", { className: "react-shell" }, [
                h("main", { key: "m", className: "react-main react-page wrap" }, children),
                h(ConfirmDialog, {
                    key: "logout-dialog",
                    open: Boolean(logoutConfirm),
                    title: "\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430",
                    text: "\u0412\u044b \u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441\u0435\u0441\u0441\u0438\u044e?",
                    onCancel: closeLogoutConfirm,
                    onConfirm: confirmLogout
                })
            ]);
        }
        if (user && user.role === "admin") {
            return h("div", { className: "react-shell" }, [
                h(AdminShell, { key: "admin", onLogoutRequest }, children),
                h(ConfirmDialog, {
                    key: "logout-dialog",
                    open: Boolean(logoutConfirm),
                    title: "\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430",
                    text: "\u0412\u044b \u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441\u0435\u0441\u0441\u0438\u044e?",
                    onCancel: closeLogoutConfirm,
                    onConfirm: confirmLogout
                })
            ]);
        }
        if (user && user.role === "seller") {
            return h("div", { className: "react-shell" }, [
                h(SellerShell, { key: "seller", onLogoutRequest }, children),
                h(ConfirmDialog, {
                    key: "logout-dialog",
                    open: Boolean(logoutConfirm),
                    title: "\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430",
                    text: "Вы точно хотите завершить сессию?",
                    onCancel: closeLogoutConfirm,
                    onConfirm: confirmLogout
                })
            ]);
        }
        return h("div", { className: "react-shell" }, [
            h(Header, { key: "h", onLogoutRequest, onBecomeSellerRequest }),
            h("main", { key: "m", className: "react-main react-page wrap" }, children),
            h(Footer, { key: "f" }),
            h(ConfirmDialog, {
                key: "logout-dialog",
                open: Boolean(logoutConfirm),
                title: "\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430",
                text: "\u0412\u044b \u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441\u0435\u0441\u0441\u0438\u044e?",
                onCancel: closeLogoutConfirm,
                onConfirm: confirmLogout
            }),
            h(SellerSignupModal, { key: "seller-signup", open: sellerSignupOpen, onClose: closeSellerSignup }),
            h(NoticeDialog, {
                key: "notice-dialog",
                open: showGlobalNotice,
                title: "\u0417\u0430\u044f\u0432\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430",
                text: noticeMessage || "",
                onClose: closeNotice
            })
        ]);
    }
    function ProductCard({ product, favorite }) {
        if (!product) return null;
        const status = stockStatus(product);
        return h("article", { className: `react-product-card stock-${status}` }, [
            A({ key: "img", href: `/product/${product.id}`, className: "react-product-image" },
                h(ProductMedia, { product })
            ),
            h("div", { key: "body", className: "react-product-body" }, [
                h("div", { key: "chips", className: "react-chip-row" }, [product.category && h("span", { className: "react-chip" }, product.category), product.seller_rating && h("span", { className: "react-chip" }, `\u0432\u0098\u2026 ${product.seller_rating}`)]),
                A({ key: "name", href: `/product/${product.id}`, className: "react-product-name" }, product.name),
                sellerLink(product)
                    ? A({ key: "seller", href: sellerLink(product), className: "react-muted" }, `\u043e\u0442 ${ownerName(product)}`)
                    : h("div", { key: "seller", className: "react-muted" }, `\u043e\u0442 ${ownerName(product)}`),
                h(PriceDisplay, { key: "price", product }),
                h("div", { key: "stock", className: `react-stock-label stock-${status}` }, stockText(product)),
                h("div", { key: "actions", className: "react-actions" }, [
                    canBuy(product)
                        ? PostButton({ action: `/cart/add/${product.id}`, children: "\u0412 \u043a\u043e\u0440\u0437\u0438\u043d\u0443" })
                        : h("span", { className: "react-stock-empty" }, "\u041d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438"),
                    FavoriteButton({ product, favorite })
                ])
            ])
        ]);
    }
    function FavoriteButton({ product, favorite }) {
        return PostButton({
            action: `${favorite ? "/favorites/remove/" : "/favorites/add/"}${product.id}`,
            className: `react-icon-btn ${favorite ? "active" : ""}`,
            title: "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435",
            ariaLabel: "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435",
            icon: "heart",
            formProps: {
                "data-favorite-form": "true",
                "data-product-id": product.id,
                "data-favorite-active": favorite ? "true" : "false"
            }
        });
    }
    function ProductsGrid({ products, favorite }) {
        const list = products || [];
        if (!list.length) return h("div", { className: "react-empty react-panel" }, "\u0422\u043e\u0432\u0430\u0440\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.");
        return h("div", { className: "react-products-grid" }, list.map(p => h(ProductCard, { key: p.id, product: p, favorite })));
    }
    function SearchEmptyState() {
        return h("div", { className: "react-empty react-panel react-stack" }, [
            h("p", null, "\u041f\u043e \u0432\u0430\u0448\u0435\u043c\u0443 \u0437\u0430\u043f\u0440\u043e\u0441\u0443 \u043d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e."),
            h("p", { className: "react-muted" }, "\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u0444\u043e\u0440\u043c\u0443\u043b\u0438\u0440\u043e\u0432\u043a\u0443: \u043c\u043e\u043b\u043e\u0447\u043a\u0430, \u043e\u0432\u043e\u0449\u0438, \u043a \u0447\u0430\u044e \u0438\u043b\u0438 \u0437\u0430\u0432\u0442\u0440\u0430\u043a.")
        ]);
    }
    function HomePage() {
        const banners = [
            ["/catalog?category=new", "\u041d\u041e\u0412\u0418\u041d\u041a\u0418\n\u041d\u0415\u0414\u0415\u041b\u0418", "sparkles", "tone-orange"],
            ["/catalog?category=\u0444\u0440\u0443\u043a\u0442\u044b", "\u0424\u0420\u0423\u041a\u0422\u042b\n\u0418 \u042f\u0413\u041e\u0414\u042b", "apple", "tone-pink"],
            ["/catalog?category=sale", "\u0417\u0415\u041b\u0415\u041d\u042b\u0415\n\u0426\u0415\u041d\u042b", "badge-percent", "tone-green"],
            ["/catalog?category=popular", "\u0425\u0418\u0422\u042b", "flame", "tone-yellow"]
        ];
        return h(React.Fragment, null, [
            h("div", { className: "react-hero-banners" }, banners.map(([href, title, icon, tone]) => h("div", { key: href, className: `react-banner ${tone}`, "aria-disabled": "true" }, [h("strong", null, title.split("\n").map((line, i) => h(React.Fragment, { key: i }, [line, i === 0 && title.includes("\n") ? h("br") : null]))), h("span", { className: "react-banner-icon" }, Icon({ name: icon }))]))),
            h(ProductsGrid, { products: (props.products || []).slice(0, 8) })
        ]);
    }
    function CatalogPage() {
        const categories = [
            { value: "", label: "\u0412\u0441\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438" },
            { value: "\u043c\u043e\u043b\u043e\u043a\u043e", label: "\u041c\u043e\u043b\u043e\u043a\u043e" },
            { value: "\u043c\u044f\u0441\u043e", label: "\u041c\u044f\u0441\u043e" },
            { value: "\u043e\u0432\u043e\u0449\u0438", label: "\u041e\u0432\u043e\u0449\u0438" },
            { value: "\u0444\u0440\u0443\u043a\u0442\u044b", label: "\u0424\u0440\u0443\u043a\u0442\u044b" },
            { value: "\u044f\u0433\u043e\u0434\u044b", label: "\u042f\u0433\u043e\u0434\u044b" },
            { value: "\u0441\u044b\u0440", label: "\u0421\u044b\u0440" },
            { value: "\u043a\u0443\u0440\u0438\u0446\u0430", label: "\u041a\u0443\u0440\u0438\u0446\u0430" },
            { value: "\u044f\u0439\u0446\u0430", label: "\u042f\u0439\u0446\u0430" },
            { value: "\u043c\u0451\u0434", label: "\u041c\u0451\u0434" },
            { value: "\u0445\u043b\u0435\u0431", label: "\u0425\u043b\u0435\u0431" },
            { value: "\u0431\u0430\u043a\u0430\u043b\u0435\u044f", label: "\u0411\u0430\u043a\u0430\u043b\u0435\u044f" },
            { value: "\u043a\u043e\u043d\u0441\u0435\u0440\u0432\u044b", label: "\u041a\u043e\u043d\u0441\u0435\u0440\u0432\u044b" },
            { value: "\u0437\u0430\u043c\u043e\u0440\u043e\u0437\u043a\u0430", label: "\u0417\u0430\u043c\u043e\u0440\u043e\u0437\u043a\u0430" },
            { value: "\u043d\u0430\u043f\u0438\u0442\u043a\u0438", label: "\u041d\u0430\u043f\u0438\u0442\u043a\u0438" },
            { value: "\u0441\u043b\u0430\u0434\u043e\u0441\u0442\u0438", label: "\u0421\u043b\u0430\u0434\u043e\u0441\u0442\u0438" }
        ];
        const [selectedCategory, setSelectedCategory] = React.useState(props.category || "");
        const [selectedSort, setSelectedSort] = React.useState(props.sort || "rating");
        const [selectedStock, setSelectedStock] = React.useState(props.in_stock || "");
        const [selectedCert, setSelectedCert] = React.useState(props.has_certificate || "");
        const sortOptions = [
            { value: "rating", label: "\u041f\u043e \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u0443" },
            { value: "popular", label: "\u041f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0435" },
            { value: "newest", label: "\u041d\u043e\u0432\u0438\u043d\u043a\u0438" },
            { value: "price_asc", label: "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0434\u0435\u0448\u0435\u0432\u043b\u0435" },
            { value: "price_desc", label: "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0434\u043e\u0440\u043e\u0436\u0435" }
        ];
        const stockOptions = [
            { value: "", label: "\u041b\u044e\u0431\u0430\u044f \u043d\u0430\u043b\u0438\u0447\u0438\u0435" },
            { value: "1", label: "\u0422\u043e\u043b\u044c\u043a\u043e \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438" }
        ];
        const certOptions = [
            { value: "", label: "\u041b\u044e\u0431\u043e\u0439 \u0442\u0438\u043f" },
            { value: "1", label: "\u0421 \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u043c" }
        ];
        const pageNum = Number(props.page_num || 1);
        const totalPages = Number(props.total_pages || 1);
        const makeCatalogPageHref = targetPage => {
            const params = new URLSearchParams();
            if (props.category) params.set("category", props.category);
            if (props.sort) params.set("sort", props.sort);
            if (props.min_price !== undefined && props.min_price !== null && props.min_price !== "") params.set("min_price", props.min_price);
            if (props.max_price !== undefined && props.max_price !== null && props.max_price !== "") params.set("max_price", props.max_price);
            if (props.in_stock) params.set("in_stock", props.in_stock);
            if (props.has_certificate) params.set("has_certificate", props.has_certificate);
            params.set("page", String(targetPage));
            return `/catalog?${params.toString()}`;
        };
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [page === "search" ? null : h("h1", null, page === "favorites" ? "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435" : "\u041a\u0430\u0442\u0430\u043b\u043e\u0433"), h("span", { className: "react-muted" }, `${(props.products || []).length} \u0442\u043e\u0432\u0430\u0440\u043e\u0432`)]),
            props.search_hint && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.search_hint),
            page !== "favorites" && page !== "search" && h("form", { action: "/catalog", method: "get", className: "react-panel react-form-grid" }, [
                    h("div", { key: "cat", className: "wide react-stack" }, [
                        h("div", { className: "react-chip-row" }, categories.map(c => h("button", {
                            type: "button",
                            className: `react-chip react-chip-button${selectedCategory === c.value ? " active" : ""}`,
                            onClick: () => setSelectedCategory(c.value),
                            "aria-pressed": selectedCategory === c.value ? "true" : "false"
                        }, c.label)),
                        ),
                        h("input", { type: "hidden", name: "category", value: selectedCategory })
                    ]),
                    h("div", { key: "sort", className: "wide react-stack" }, [
                        h("div", { className: "react-chip-row" }, sortOptions.map(item => h("button", {
                            type: "button",
                            className: `react-chip react-chip-button${selectedSort === item.value ? " active" : ""}`,
                            onClick: () => setSelectedSort(item.value),
                            "aria-pressed": selectedSort === item.value ? "true" : "false"
                        }, item.label))),
                        h("input", { type: "hidden", name: "sort", value: selectedSort || "rating" })
                    ]),
                    Field({ key: "min", name: "min_price", type: "number", step: "0.01", min: "0", placeholder: "\u0426\u0435\u043d\u0430 \u043e\u0442", defaultValue: props.min_price || "" }),
                    Field({ key: "max", name: "max_price", type: "number", step: "0.01", min: "0", placeholder: "\u0426\u0435\u043d\u0430 \u0434\u043e", defaultValue: props.max_price || "" }),
                    h("div", { key: "stock", className: "react-chip-row" }, stockOptions.map(item => h("button", {
                        type: "button",
                        className: `react-chip react-chip-button${selectedStock === item.value ? " active" : ""}`,
                        onClick: () => setSelectedStock(item.value),
                        "aria-pressed": selectedStock === item.value ? "true" : "false"
                    }, item.label))),
                    h("input", { key: "stock-hidden", type: "hidden", name: "in_stock", value: selectedStock }),
                    h("div", { key: "cert", className: "react-chip-row" }, certOptions.map(item => h("button", {
                        type: "button",
                        className: `react-chip react-chip-button${selectedCert === item.value ? " active" : ""}`,
                        onClick: () => setSelectedCert(item.value),
                        "aria-pressed": selectedCert === item.value ? "true" : "false"
                    }, item.label))),
                    h("input", { key: "cert-hidden", type: "hidden", name: "has_certificate", value: selectedCert }),
                    h("button", { key: "submit", className: "react-btn wide", type: "submit" }, "\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c")
                ]),
            page === "search" && !(props.products || []).length
                ? h(SearchEmptyState)
                : h(React.Fragment, null, [
                    h(ProductsGrid, { key: "grid", products: props.products || [], favorite: page === "favorites" }),
                    totalPages > 1 && h("div", { key: "pager", className: "react-actions", style: { marginTop: 16, justifyContent: "center" } }, [
                        pageNum > 1 ? ButtonLink({ href: makeCatalogPageHref(pageNum - 1), className: "secondary" }, "\u041d\u0430\u0437\u0430\u0434") : h("span"),
                        h("span", { className: "react-muted" }, `${pageNum} / ${totalPages}`),
                        pageNum < totalPages ? ButtonLink({ href: makeCatalogPageHref(pageNum + 1), className: "secondary" }, "\u0414\u0430\u043b\u0435\u0435") : h("span")
                    ])
                ])
        ]);
    }
    function ProductPage() {
        const product = props.product || {};
        const status = stockStatus(product);
        return h(React.Fragment, null, [
            h("section", { className: "react-product-detail" }, [
                h("div", { className: "react-product-detail-image react-panel" },
                    h(ProductMedia, { product })
                ),
                h("div", { className: "react-panel react-stack" }, [
                    h("div", { className: "react-chip-row" }, [product.category && h("span", { className: "react-chip" }, product.category), product.has_certificate ? h("span", { className: "react-chip" }, "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442") : null]),
                    h("h1", null, product.name),
                    h(PriceDisplay, { product }),
                    h("p", null, product.description || "\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u044b\u0439 \u0444\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0438\u0439 \u043f\u0440\u043e\u0434\u0443\u043a\u0442 \u0441 \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u043c \u0441\u043e\u0441\u0442\u0430\u0432\u043e\u043c \u0438 \u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u043e\u0439 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u043e\u0439."),
                    h("div", { className: "react-info-grid react-product-spec-grid" }, [
                        h("div", { className: "react-card react-product-spec-card" }, [
                            h("b", { className: "react-product-spec-label" }, "\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446"),
                            sellerLink(product)
                                ? A({ href: sellerLink(product), className: "react-product-spec-value" }, ownerName(product))
                                : h("div", { className: "react-product-spec-value" }, ownerName(product))
                        ]),
                        h("div", { className: "react-card react-product-spec-card" }, [h("b", { className: "react-product-spec-label" }, "\u0420\u0435\u0433\u0438\u043e\u043d"), h("div", { className: "react-product-spec-value" }, product.region || "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f")]),
                        h("div", { className: "react-card react-product-spec-card" }, [h("b", { className: "react-product-spec-label" }, "\u0424\u0430\u0441\u043e\u0432\u043a\u0430"), h("div", { className: "react-product-spec-value" }, product.weight_per_unit || "\u041f\u043e \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0435\u043d\u043d\u043e\u0441\u0442\u0438")]),
                        h("div", { className: "react-card react-product-spec-card" }, [h("b", { className: "react-product-spec-label" }, "\u041e\u0441\u0442\u0430\u0442\u043e\u043a"), h("div", { className: `react-product-spec-value react-stock-value stock-${status}` }, stockText(product))]),
                        h("div", { className: "react-card react-product-spec-card" }, [h("b", { className: "react-product-spec-label" }, "\u0421\u0440\u043e\u043a \u0433\u043e\u0434\u043d\u043e\u0441\u0442\u0438"), h("div", { className: "react-product-spec-value" }, product.expiration_days ? `${product.expiration_days} \u0434\u043d.` : "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f")])
                    ]),
                    h("div", { className: "react-actions" }, [
                        canBuy(product)
                            ? PostButton({ action: `/cart/add/${product.id}`, children: "\u0412 \u043a\u043e\u0440\u0437\u0438\u043d\u0443" })
                            : h("span", { className: "react-stock-empty" }, "\u041d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438"),
                        FavoriteButton({ product, favorite: false }),
                        user && user.role === "user" && ButtonLink({ href: `/conversations/product/${product.id}`, className: "secondary" }, "\u0417\u0430\u0434\u0430\u0442\u044c \u0432\u043e\u043f\u0440\u043e\u0441 \u0444\u0435\u0440\u043c\u0435\u0440\u0443")
                    ])
                ])
            ]),
            h(ReviewsBlock, { reviews: props.reviews || [] }),
            h("div", { className: "react-page-title", style: { marginTop: 28 } }, h("h2", null, "\u041f\u043e\u0445\u043e\u0436\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u044b")),
            h(ProductsGrid, { products: props.similar || getSimilarProducts(product, props.all_products || []) })
        ]);
    }
    function ReviewsBlock({ reviews }) {
        return h("section", { className: "react-panel" }, [
            h("div", { className: "react-page-title" }, [h("h2", null, "\u041e\u0442\u0437\u044b\u0432\u044b"), A({ href: props.product ? `/reviews/product/${props.product.id}` : "/reviews", className: "react-btn secondary" }, "\u0412\u0441\u0435 \u043e\u0442\u0437\u044b\u0432\u044b")]),
            (reviews || []).length ? h("div", { className: "react-stack" }, reviews.map(r => h("div", { key: r.id || (r.review && r.review.id), className: "react-card" }, [
                h("div", null, "\u0432\u0098\u2026".repeat((r.review || r).rating || 5)),
                h("p", null, (r.review || r).text || "\u0411\u0435\u0437 \u0442\u0435\u043a\u0441\u0442\u0430"),
                (r.review || r).seller_response && h("p", { className: "react-muted" }, `\u041e\u0442\u0432\u0435\u0442 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430: ${(r.review || r).seller_response}`)
            ]))) : h("div", { className: "react-empty" }, "\u041e\u0442\u0437\u044b\u0432\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    function LoginPage({ onBecomeSellerRequest }) {
        return h("div", { className: "react-panel", style: { maxWidth: 520, margin: "0 auto" } }, [
            h("h1", null, "\u0412\u0445\u043e\u0434"),
            props.error && h("p", { className: "alert alert-danger" }, props.error),
            h("form", { action: "/login", method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                Field({ name: "email", type: "email", placeholder: "Email", defaultValue: props.email, required: true }),
                Field({ name: "password", type: "password", placeholder: "\u041f\u0430\u0440\u043e\u043b\u044c", required: true }),
                h("button", { className: "react-btn", type: "submit" }, "\u0412\u043e\u0439\u0442\u0438")
            ]),
            h("div", { className: "react-stack", style: { marginTop: 16 } }, [
                h("p", { key: "buyer" }, ["\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430? ", A({ href: "/register" }, "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f")]),
                h("p", { key: "seller" }, ["\u0425\u043e\u0442\u0438\u0442\u0435 \u043f\u0440\u043e\u0434\u0430\u0432\u0430\u0442\u044c \u043d\u0430 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0435? ", A({ href: "/become-seller", onClick: onBecomeSellerRequest }, "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c")])
            ])
        ]);
    }
    function AuthTabs({ active, onBecomeSellerRequest }) {
        return h("div", { className: "react-tab-row", style: { marginBottom: 18 } }, [
            ButtonLink({ href: "/register", className: active === "buyer" ? "" : "secondary", key: "buyer" }, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c"),
            A({ href: "/become-seller", onClick: onBecomeSellerRequest, className: `react-btn ${active === "seller" ? "" : "secondary"}` }, "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c")
        ]);
    }
    function RegisterPage({ onBecomeSellerRequest }) {
        return h("div", { className: "react-panel", style: { maxWidth: 560, margin: "0 auto" } }, [
            h(AuthTabs, { active: "buyer", onBecomeSellerRequest }),
            h("h1", null, "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044f"),
            props.error && h("p", { className: "alert alert-danger" }, props.error),
            h("form", { action: "/register", method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                Field({ name: "email", type: "email", placeholder: "Email", defaultValue: props.email, required: true }),
                Field({ name: "password", type: "password", placeholder: "\u041f\u0430\u0440\u043e\u043b\u044c", required: true, minLength: 6 }),
                h("button", { className: "react-btn", type: "submit" }, "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442")
            ]),
            h("p", { className: "react-muted", style: { marginTop: 14 } }, "\u0414\u043b\u044f \u043f\u0440\u043e\u0434\u0430\u0436 \u043d\u0430 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0435 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u0443\u044e \u0430\u043d\u043a\u0435\u0442\u0443 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430.")
        ]);
    }
    function BecomeSellerPage() {
        return h("div", { className: "react-panel", style: { maxWidth: 820, margin: "0 auto" } }, [
            h(AuthTabs, { active: "seller" }),
            h("h1", null, "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c"),
            h("p", { className: "react-muted" }, "\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0430\u043d\u043a\u0435\u0442\u0443 \u0444\u0435\u0440\u043c\u0435\u0440\u0430. \u041f\u043e\u0441\u043b\u0435 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438 \u0430\u0434\u043c\u0438\u043d\u043e\u043c \u0432\u044b \u0441\u043c\u043e\u0436\u0435\u0442\u0435 \u0432\u0445\u043e\u0434\u0438\u0442\u044c \u0447\u0435\u0440\u0435\u0437 \u043e\u0431\u044b\u0447\u043d\u043e\u0435 \u043e\u043a\u043d\u043e \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438."),
            props.error && h("p", { className: "alert alert-danger" }, props.error),
            h(SellerApplicationForm, { compact: false })
        ]);
    }
    function SellerPendingPage() {
        const status = props.application_status || "pending";
        const rejected = status === "rejected";
        return h("section", { className: "react-panel react-stack", style: { maxWidth: 760, margin: "0 auto" } }, [
            h("h1", null, "\u0410\u043d\u043a\u0435\u0442\u0430 \u0444\u0435\u0440\u043c\u0435\u0440\u0430"),
            props.notice_message ? h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35", background: "#f6fbf2" } }, props.notice_message) : null,
            h("div", { className: "react-chip-row" }, [
                h("span", { className: "react-chip" }, sellerApplicationStatusText(status))
            ]),
            rejected
                ? h("p", null, "\u0410\u043d\u043a\u0435\u0442\u0430 \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0430. \u041f\u043e\u0441\u043b\u0435 \u043f\u0440\u0430\u0432\u043e\u043a \u043c\u043e\u0436\u043d\u043e \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u043e\u043c.")
                : h("p", null, "\u0410\u043d\u043a\u0435\u0442\u0430 \u043d\u0430\u0445\u043e\u0434\u0438\u0442\u0441\u044f \u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438. \u0414\u043e \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u044f \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u0442\u043e\u0432\u0430\u0440\u0430\u043c \u0438 \u0437\u0430\u043a\u0430\u0437\u0430\u043c \u0437\u0430\u043a\u0440\u044b\u0442."),
            props.application_rejection_reason ? h("div", { className: "alert alert-danger" }, props.application_rejection_reason) : null,
            h("div", { className: "react-actions" }, [
                ButtonLink({ href: "/" }, "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e"),
                A({ href: "/logout", className: "react-btn secondary" }, "\u0412\u044b\u0439\u0442\u0438")
            ])
        ]);
    }
    function CartItemRow({ item, sellerName }) {
        const product = item && item.product;
        if (!product) {
            return h("div", { key: item.id, className: "react-cart-item react-cart-item-missing" }, [
                h("p", null, "\u0422\u043e\u0432\u0430\u0440 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d."),
                PostButton({ action: `/cart/remove/${item.id}`, children: "\u0423\u0431\u0440\u0430\u0442\u044c", className: "react-btn secondary" })
            ]);
        }
        const status = stockStatus(product);
        const plusDisabled = Number(item.quantity || 0) >= stockQuantity(product);
        return h("div", { key: item.id, className: "react-cart-item" }, [
            h("div", { className: "react-cart-item-main" }, [
                h(ProductMiniPreview, { product }),
                h("span", { className: "react-cart-subtitle" }, `${money(productFinalPrice(product))}${product.weight_per_unit ? `/${product.weight_per_unit}` : ""}`),
                h("span", { className: `react-stock-label stock-${status}` }, stockText(product)),
                h("span", { className: "react-muted react-cart-seller-name" }, sellerName || "")
            ]),
            h("div", { className: "react-cart-item-controls" }, [
                PostButton({ action: `/cart/remove/${item.id}`, className: "react-icon-btn", icon: "trash-2", title: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c" }),
                PostButton({ action: `/cart/dec/${item.id}`, className: "react-icon-btn", icon: "minus", title: "\u0423\u043c\u0435\u043d\u044c\u0448\u0438\u0442\u044c" }),
                h("span", { className: "react-cart-qty" }, item.quantity),
                plusDisabled
                    ? h("button", { type: "button", className: "react-icon-btn", disabled: true, title: "\u0411\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u0442 \u043d\u0430 \u0441\u043a\u043b\u0430\u0434\u0435" }, Icon({ name: "plus" }))
                    : PostButton({ action: `/cart/inc/${item.id}`, className: "react-icon-btn", icon: "plus", title: "\u0423\u0432\u0435\u043b\u0438\u0447\u0438\u0442\u044c" })
            ]),
            h("div", { className: "react-cart-item-total" }, money(productFinalPrice(product) * item.quantity))
        ]);
    }
    function CartPage() {
        const groups = props.seller_groups || [];
        const hasItems = groups.some(group => (group.cart_items || []).length > 0);
        const checkout = props.checkout_form || {};
        const today = new Date();
        const todayStr = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10);
        const defaultDate = checkout.delivery_date || todayStr;
        const totalCount = groups.reduce((acc, group) => acc + (group.cart_items || []).length, 0);
        const goodsTotal = Number(props.total || 0);
        const [deliveryMethod, setDeliveryMethod] = React.useState(checkout.delivery_method || "courier");
        const [paymentMethod, setPaymentMethod] = React.useState("yookassa");
        const [deliveryDate, setDeliveryDate] = React.useState(defaultDate);
        const [deliverySlot, setDeliverySlot] = React.useState(checkout.delivery_slot_choice || "10-14");
        const [minOrderNoticeOpen, setMinOrderNoticeOpen] = React.useState(false);
        const deliveryMap = { pickup: 0, courier: 500 };
        const slotOptions = [
            { value: "10-14", label: "10:00 - 14:00", endHour: 14 },
            { value: "14-18", label: "14:00 - 18:00", endHour: 18 },
            { value: "18-22", label: "18:00 - 22:00", endHour: 22 }
        ];
        const isToday = deliveryDate === todayStr;
        const deliveryFee = Number(deliveryMap[deliveryMethod] || 0);
        const grandTotal = goodsTotal + deliveryFee;
        const minOrderAmount = Number(props.min_order_amount || 3000);
        const minOrderShortage = Math.max(0, Number(props.min_order_shortage != null ? props.min_order_shortage : (minOrderAmount - goodsTotal)));
        const hasMinOrderErrors = minOrderShortage > 0;
        const minOrderText = `Минимальная сумма заказа: ${money(minOrderAmount)}`;
        const minOrderMessage = props.min_order_message || `Минимальная сумма заказа — ${money(minOrderAmount)}. Добавьте товары еще на ${money(minOrderShortage)}.`;
        const handleCheckoutSubmit = event => {
            if (hasMinOrderErrors) {
                event.preventDefault();
                setMinOrderNoticeOpen(true);
                return false;
            }
            return handleSubmitOnce(event);
        };
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [h("h1", null, "\u041a\u043e\u0440\u0437\u0438\u043d\u0430")]),
            props.cart_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.cart_error),
            props.cart_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.cart_success),
            hasItems ? h("div", { className: "react-cart-layout" }, [
                h("section", { className: "react-panel react-cart-main" }, [
                    h("div", { className: "react-cart-items" }, groups.flatMap(group => {
                        const sellerName = group.seller_name || "\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446";
                        return (group.cart_items || []).map(item => h(CartItemRow, { key: `${group.seller_id}-${item.id}`, item, sellerName }));
                    }))
                ]),
                h("aside", { className: "react-panel react-cart-summary" }, [
                    h("div", { className: "react-cart-summary-row" }, [h("span", null, "\u041a\u043e\u043b-\u0432\u043e \u0442\u043e\u0432\u0430\u0440\u043e\u0432"), h("b", null, totalCount)]),
                    h("div", { className: "react-cart-summary-row" }, [h("span", null, "\u0421\u0443\u043c\u043c\u0430 \u0442\u043e\u0432\u0430\u0440\u043e\u0432"), h("b", null, money(goodsTotal))]),
                    h("div", { className: "react-cart-summary-row" }, [h("span", null, "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"), h("b", null, money(deliveryFee))]),
                    h("div", { className: "react-cart-summary-row" }, [h("span", null, "\u0418\u0442\u043e\u0433"), h("b", null, money(grandTotal))]),
                    h("form", { action: "/order/create", method: "post", className: "react-cart-checkout-form", onSubmit: handleCheckoutSubmit }, [
                        h("div", { className: "react-form-grid" }, [
                            Field({ name: "full_name", placeholder: "\u0424\u0418\u041e \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044f", defaultValue: checkout.full_name || (user && user.full_name) || "", required: true, maxLength: 255 }),
                            Field({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: checkout.phone || (user && user.phone) || "", required: true, maxLength: 50 }),
                            h("input", { type: "hidden", name: "delivery_method", value: deliveryMethod }),
                            h("input", { type: "hidden", name: "payment_method", value: paymentMethod }),
                            h("input", { type: "hidden", name: "delivery_slot_choice", value: deliverySlot }),
                            h("div", { className: "wide react-stack" }, [
                                h("label", { className: "react-muted" }, "Способ доставки"),
                                h("div", { className: "react-chip-row" }, [
                                    h("button", { type: "button", className: `react-chip react-chip-button ${deliveryMethod === "pickup" ? "active" : ""}`, onClick: () => setDeliveryMethod("pickup") }, "Самовывоз"),
                                    h("button", { type: "button", className: `react-chip react-chip-button ${deliveryMethod === "courier" ? "active" : ""}`, onClick: () => setDeliveryMethod("courier") }, "Курьер")
                                ])
                            ]),
                            h("div", { className: "wide react-stack" }, [
                                h("label", { className: "react-muted" }, "Способ оплаты"),
                                h("div", { className: "react-chip-row" }, [
                                    h("button", { type: "button", className: "react-chip react-chip-button active", onClick: () => setPaymentMethod("yookassa") }, "Онлайн")
                                ])
                            ]),
                            Field({ name: "address", placeholder: "\u0410\u0434\u0440\u0435\u0441 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u0438\u043b\u0438 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043a \u0441\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437\u0443", defaultValue: checkout.address || "", className: "wide", maxLength: 500 }),
                            Field({ name: "coupon_code", placeholder: "\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434", defaultValue: checkout.coupon_code || "", maxLength: 50 }),
                            Field({ name: "delivery_date", type: "date", defaultValue: defaultDate, min: todayStr, onChange: e => setDeliveryDate(e.target.value) }),
                            h("div", { className: "wide react-stack" }, [
                                h("label", { className: "react-muted" }, "Слот доставки"),
                                h("div", { className: "react-chip-row" }, slotOptions.map(slot => {
                                    const disabled = isToday && today.getHours() >= slot.endHour;
                                    return h("button", {
                                        type: "button",
                                        disabled,
                                        className: `react-chip react-chip-button ${deliverySlot === slot.value ? "active" : ""}`,
                                        onClick: () => !disabled && setDeliverySlot(slot.value)
                                    }, slot.label);
                                }))
                            ]),
                            Textarea({ name: "comment", placeholder: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043a \u0437\u0430\u043a\u0430\u0437\u0443", defaultValue: checkout.comment || "", className: "wide", rows: 4, maxLength: 2000 })
                        ]),
                        h("button", {
                            className: `react-btn react-cart-submit ${hasMinOrderErrors ? "is-disabled" : ""}`,
                            type: "submit",
                            "aria-disabled": hasMinOrderErrors ? "true" : "false"
                        }, "\u041e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437"),
                        minOrderText && h("p", { className: "react-muted react-cart-min-order" }, minOrderText),
                        hasMinOrderErrors && h("span", { className: "react-cart-min-order-warning" }, minOrderMessage)
                    ]),
                    h("div", { className: "react-cart-clear-wrap" }, [
                        PostButton({ action: "/cart/clear", children: "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043a\u043e\u0440\u0437\u0438\u043d\u0443", className: "react-btn secondary", confirmMessage: "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043a\u043e\u0440\u0437\u0438\u043d\u0443?" })
                    ])
                ])
            ]) : h("div", { className: "react-empty react-panel" }, [h("p", null, "\u041a\u043e\u0440\u0437\u0438\u043d\u0430 \u043f\u0443\u0441\u0442\u0430\u044f."), ButtonLink({ href: "/catalog" }, "\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u043a\u0430\u0442\u0430\u043b\u043e\u0433")]),
            h(NoticeDialog, {
                open: minOrderNoticeOpen,
                title: "Минимальная сумма заказа",
                text: minOrderMessage,
                onClose: () => setMinOrderNoticeOpen(false)
            })
        ]);
    }
    function SellerPage() {
        const financials = props.financials || {};
        const products = props.products || [];
        const seller = props.seller || {};
        const certificates = props.certificates || [];
        const [tab, setTab] = React.useState("overview");
        const [productFilter, setProductFilter] = React.useState("all");
        const activeProducts = products.filter(product => product.status === "approved");
        const pendingProducts = products.filter(product => product.status === "pending");
        const rejectedProducts = products.filter(product => product.status === "rejected");
        const lowStockProducts = products.filter(product => stockStatus(product) === "low");
        const outOfStockProducts = products.filter(product => stockStatus(product) === "out");
        const recentProducts = products.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0)).slice(0, 5);
        const filteredProducts = products.filter(product => {
            if (productFilter === "active") return product.status === "approved";
            if (productFilter === "pending") return product.status === "pending";
            if (productFilter === "rejected") return product.status === "rejected";
            if (productFilter === "low_stock") return stockStatus(product) === "low";
            if (productFilter === "out_of_stock") return stockStatus(product) === "out";
            return true;
        });
        const tabs = [
            { id: "overview", label: "\u041e\u0431\u0437\u043e\u0440" },
            { id: "profile", label: "\u0410\u043d\u043a\u0435\u0442\u0430" },
            { id: "products", label: "\u0422\u043e\u0432\u0430\u0440\u044b" },
            { id: "add", label: "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c" },
            { id: "finance", label: "\u0424\u0438\u043d\u0430\u043d\u0441\u044b" }
        ];
        const productFilters = [
            { id: "all", label: "\u0412\u0441\u0435" },
            { id: "active", label: "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435" },
            { id: "low_stock", label: "\u0417\u0430\u043a\u0430\u043d\u0447\u0438\u0432\u0430\u044e\u0442\u0441\u044f" },
            { id: "out_of_stock", label: "\u041d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438" },
            { id: "pending", label: "\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f" },
            { id: "rejected", label: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043d\u044b\u0435" }
        ];
        function tabButton(item) {
            return h("button", {
                key: item.id,
                type: "button",
                className: `react-btn ${tab === item.id ? "" : "secondary"}`,
                onClick: () => setTab(item.id)
            }, item.label);
        }
        function filterButton(item) {
            return h("button", {
                key: item.id,
                type: "button",
                className: `react-btn ${productFilter === item.id ? "" : "secondary"}`,
                onClick: () => setProductFilter(item.id)
            }, item.label);
        }
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u041a\u0430\u0431\u0438\u043d\u0435\u0442 \u0444\u0435\u0440\u043c\u0435\u0440\u0430"),
                h("div", { className: "react-actions" }, [
                    ButtonLink({ href: "/seller/settings", className: "secondary" }, "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438"),
                    ButtonLink({ href: "/seller/orders", className: "secondary" }, "\u0417\u0430\u043a\u0430\u0437\u044b")
                ])
            ]),
            props.seller_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.seller_error),
            props.seller_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.seller_success),
            h("div", { className: "react-tab-row" }, tabs.map(tabButton)),
            tab === "profile" && h(React.Fragment, null, [
                h("section", { className: "react-panel react-stack" }, [
                    h("div", { className: "react-page-title" }, [h("h2", null, "\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0444\u0435\u0440\u043c\u0435\u0440\u0430")]),
                    h("form", { action: "/seller/profile/update", method: "post", encType: "multipart/form-data", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                        Field({ name: "full_name", placeholder: "\u0418\u043c\u044f", defaultValue: seller.full_name || "", maxLength: 255 }),
                        Field({ name: "farm_name", placeholder: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0444\u0435\u0440\u043c\u044b", defaultValue: seller.farm_name || "", required: true, maxLength: 255 }),
                        Field({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: seller.phone || "", maxLength: 50 }),
                        Field({ name: "inn", placeholder: "\u0418\u041d\u041d", defaultValue: seller.inn || "", maxLength: 20 }),
                        Field({ name: "farm_address", placeholder: "\u0420\u0435\u0433\u0438\u043e\u043d / \u0430\u0434\u0440\u0435\u0441", defaultValue: seller.farm_address || "", className: "wide", maxLength: 500 }),
                        Field({ name: "supplier_registration_data", placeholder: "\u0415\u0413\u0420\u0418\u041f/\u0415\u0413\u0420\u042e\u041b \u0438\u043b\u0438 \u0434\u0430\u043d\u043d\u044b\u0435 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438", defaultValue: seller.supplier_registration_data || "", className: "wide", maxLength: 1000 }),
                        Textarea({ name: "supplier_bank_details", placeholder: "\u0420\u0435\u043a\u0432\u0438\u0437\u0438\u0442\u044b \u0438 \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430", defaultValue: seller.supplier_bank_details || "", className: "wide", rows: 3, maxLength: 1000 }),
                        Textarea({ name: "farm_description", placeholder: "\u041e \u0441\u0435\u0431\u0435 \u0438 \u0444\u0435\u0440\u043c\u0435", defaultValue: seller.farm_description || "", className: "wide", maxLength: 2000 }),
                        h("div", { className: "wide" }, [
                            h("label", { className: "react-muted" }, "\u0424\u043e\u0442\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u044f"),
                            seller.farm_photo_url ? h("img", { src: seller.farm_photo_url, alt: "\u0424\u0435\u0440\u043c\u0430", className: "react-passport-preview" }) : null,
                            h("input", { name: "farm_photo", type: "file", className: "react-input wide", accept: "image/*" })
                        ]),
                        h("div", { className: "wide" }, [
                            h("label", { className: "react-muted" }, "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430"),
                            seller.supplier_document_url ? A({ href: seller.supplier_document_url, target: "_blank", className: "react-btn secondary" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442") : null,
                            h("input", { name: "supplier_document", type: "file", className: "react-input wide", accept: "image/*,application/pdf" })
                        ]),
                        h("div", { className: "wide" }, [
                            h("label", { className: "react-muted" }, "\u0424\u043e\u0442\u043e \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430"),
                            seller.passport_photo_url ? h("img", { src: seller.passport_photo_url, alt: "\u041f\u0430\u0441\u043f\u043e\u0440\u0442", className: "react-passport-preview" }) : null,
                            h("input", { name: "passport_photo", type: "file", className: "react-input wide", accept: "image/*" })
                        ]),
                        h("button", { className: "react-btn wide", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c")
                    ])
                ]),
                h("section", { className: "react-panel react-stack" }, [
                    h("div", { className: "react-page-title" }, [h("h2", null, "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u044b")]),
                    h("form", { action: "/seller/profile/certificate/add", method: "post", encType: "multipart/form-data", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                        Field({ name: "title", placeholder: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u0430", className: "wide", required: true, maxLength: 255 }),
                        h("input", { name: "image", type: "file", className: "react-input wide", accept: "image/*" }),
                        h("button", { className: "react-btn wide", type: "submit" }, "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442")
                    ]),
                    certificates.length
                        ? h("div", { className: "react-cert-grid" }, certificates.map(cert => A({ key: cert.id, href: cert.image_url || "#", target: "_blank", className: "react-cert-card" }, [
                            cert.image_url ? h("img", { src: cert.image_url, alt: cert.title || "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442" }) : null,
                            h("b", null, cert.title || "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442")
                        ])))
                        : h("div", { className: "react-empty" }, "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
                ])
            ]),
            tab === "overview" && h(React.Fragment, null, [
                h("div", { className: "react-stat-grid" }, [
                    h("div", { className: "react-card" }, [h("h2", null, activeProducts.length), h("p", null, "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0442\u043e\u0432\u0430\u0440\u044b")]),
                    h("div", { className: "react-card stock-low-card" }, [h("h2", null, lowStockProducts.length), h("p", null, "\u0417\u0430\u043a\u0430\u043d\u0447\u0438\u0432\u0430\u044e\u0442\u0441\u044f")]),
                    h("div", { className: "react-card stock-out-card" }, [h("h2", null, outOfStockProducts.length), h("p", null, "\u041d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438")]),
                    h("div", { className: "react-card" }, [h("h2", null, pendingProducts.length), h("p", null, "\u041d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438")]),
                    h("div", { className: "react-card" }, [h("h2", null, financials.paid_orders_count || 0), h("p", null, "\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b")]),
                    h("div", { className: "react-card" }, [h("h2", null, money(financials.pending_payout)), h("p", null, "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u0432\u044b\u043f\u043b\u0430\u0442\u044b")])
                ]),
            ]),
            tab === "products" && h(React.Fragment, null, [
                h("div", { className: "react-page-title" }, [
                    h("h2", null, "\u041c\u043e\u0438 \u0442\u043e\u0432\u0430\u0440\u044b"),
                    h("span", { className: "react-muted" }, `${filteredProducts.length}`)
                ]),
                h("div", { className: "react-tab-row" }, productFilters.map(filterButton)),
                h(ProductTable, { products: filteredProducts, seller: true })
            ]),
            tab === "add" && h("section", { className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [h("h2", null, "\u041d\u043e\u0432\u044b\u0439 \u0442\u043e\u0432\u0430\u0440")]),
            h(ProductForm, { action: "/seller/product/add" })
            ]),
            tab === "finance" && h(React.Fragment, null, [
                h("div", { className: "react-stat-grid" }, [
                    h("div", { className: "react-card" }, [h("h2", null, financials.paid_orders_count || 0), h("p", null, "\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b")]),
                    h("div", { className: "react-card" }, [h("h2", null, money(financials.gross_revenue)), h("p", null, "\u0412\u044b\u0440\u0443\u0447\u043a\u0430")]),
                    h("div", { className: "react-card" }, [h("h2", null, money(financials.platform_fee)), h("p", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b")]),
                    h("div", { className: "react-card" }, [h("h2", null, money(financials.pending_payout)), h("p", null, "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u0432\u044b\u043f\u043b\u0430\u0442\u044b")])
                ]),
                h("section", { className: "react-panel" }, [
                    h("div", { className: "react-page-title" }, [h("h2", null, "\u041f\u043e\u044f\u0441\u043d\u0435\u043d\u0438\u0435")]),
                    h("div", { className: "react-stack" }, [
                        h("div", { className: "react-simple-row" }, [h("b", null, "\u0412\u044b\u0440\u0443\u0447\u043a\u0430"), h("span", { className: "react-muted" }, "\u0421\u0443\u043c\u043c\u0430 \u043f\u043e \u0432\u0430\u0448\u0438\u043c \u0442\u043e\u0432\u0430\u0440\u0430\u043c \u0432 \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u0430\u0445")]),
                        h("div", { className: "react-simple-row" }, [h("b", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b"), h("span", { className: "react-muted" }, "\u0422\u043e\u043b\u044c\u043a\u043e \u0432\u0430\u0448\u0430 \u0434\u043e\u043b\u044f \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u0438 \u043f\u043e \u0437\u0430\u043a\u0430\u0437\u0430\u043c")]),
                        h("div", { className: "react-simple-row" }, [h("b", null, "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u0432\u044b\u043f\u043b\u0430\u0442\u044b"), h("span", { className: "react-muted" }, "\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0434\u0435\u043d\u044c\u0433\u0438, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0435\u0449\u0435 \u043d\u0435 \u0432\u044b\u0432\u0435\u0434\u0435\u043d\u044b")])
                    ])
                ])
            ])
        ]);
    }
    function ProductForm({ action, product, admin }) {
        product = product || {};
        return h("form", { action, method: "post", encType: "multipart/form-data", className: "react-panel react-form-grid", onSubmit: handleSubmitOnce }, [
            Field({ name: "name", placeholder: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", defaultValue: product.name, required: true, maxLength: 255 }),
            Field({ name: "price", type: "number", step: "0.01", min: "0.01", placeholder: "\u0426\u0435\u043d\u0430", defaultValue: product.price, required: true }),
            Field({ name: "discount_price", type: "number", step: "0.01", min: "0", placeholder: "\u0426\u0435\u043d\u0430 \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439", defaultValue: product.discount_price || "", max: product.price || undefined }),
            Select({ name: "category", defaultValue: product.category || "Другое" }, PRODUCT_CATEGORIES.map(category => h("option", { key: category, value: category }, category))),
            Field({ name: "region", placeholder: "\u0420\u0435\u0433\u0438\u043e\u043d", defaultValue: product.region, maxLength: 200 }),
            Field({ name: "variety", placeholder: "\u0421\u043e\u0440\u0442", defaultValue: product.variety, maxLength: 100 }),
            Field({ name: "weight_per_unit", placeholder: "\u0424\u0430\u0441\u043e\u0432\u043a\u0430", defaultValue: product.weight_per_unit, maxLength: 50 }),
            Field({ name: "expiration_days", type: "number", min: "0", step: "1", placeholder: "\u0421\u0440\u043e\u043a \u0433\u043e\u0434\u043d\u043e\u0441\u0442\u0438, \u0434\u043d\u0435\u0439", defaultValue: product.expiration_days || 0 }),
            Field({ name: "stock", type: "number", min: "0", step: "1", placeholder: "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438", defaultValue: stockQuantity(product) }),
            Select({ name: "unit", defaultValue: stockUnit(product) }, PRODUCT_UNITS.map(unit => h("option", { key: unit, value: unit }, unit))),
            Field({ name: "low_stock_threshold", type: "number", min: "0", step: "1", placeholder: "\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u043e\u0441\u0442\u0430\u0442\u043e\u043a", defaultValue: product.low_stock_threshold || 0 }),
            Select({ name: "has_certificate", defaultValue: String(product.has_certificate || 0) }, [h("option", { value: "0" }, "\u0411\u0435\u0437 \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u0430"), h("option", { value: "1" }, "\u0415\u0441\u0442\u044c \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442")]),
            admin && Field({ name: "owner_id", type: "number", min: "0", step: "1", placeholder: "ID \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430", defaultValue: product.owner_id || 0 }),
            Textarea({ name: "description", placeholder: "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435", defaultValue: product.description, className: "wide", maxLength: 4000 }),
            h("input", { name: "image", type: "file", className: "react-input wide", accept: "image/*" }),
            h("button", { className: "react-btn wide", type: "submit" }, product.id ? "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c" : "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440")
        ]);
    }
    function ConversationListPage() {
        const conversations = props.conversations || [];
        return h("section", { className: "react-panel" }, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u0414\u0438\u0430\u043b\u043e\u0433\u0438"),
                user && user.role === "seller" && ButtonLink({ href: "/seller/support", className: "secondary" }, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430")
            ]),
            conversations.length ? h("div", { className: "react-stack" }, conversations.map(item => {
                const conv = item.conversation || item;
                const typeLabel = {
                    order_chat: "\u0417\u0430\u043a\u0430\u0437",
                    product_question: "\u0422\u043e\u0432\u0430\u0440",
                    complaint: "\u0416\u0430\u043b\u043e\u0431\u0430",
                    support_request: "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430",
                    finance_request: "\u0424\u0438\u043d\u0430\u043d\u0441\u044b"
                }[conv.type] || conv.type;
                return h("div", { key: conv.id, className: "react-card" }, [
                    h("b", null, `${typeLabel} #${conv.id}`),
                    h("p", null, item.order_number ? `\u0417\u0430\u043a\u0430\u0437 ${item.order_number}` : item.product_name ? item.product_name : item.complaint_id ? `\u041e\u0431\u0440. #${item.complaint_id}` : ""),
                    h("p", { className: "react-muted" }, item.last_message ? item.last_message.text : "Без сообщений"),
                    h("div", { className: "react-actions" }, [
                        ButtonLink({ href: `/conversations/${conv.id}`, className: "secondary" }, "Открыть")
                    ])
                ]);
            })) : h("div", { className: "react-empty" }, "Без диалогов.")
        ]);
    }
    function ConversationPage() {
        const conversation = props.conversation || {};
        const messages = props.messages || [];
        const typeLabel = {
            order_chat: "\u0417\u0430\u043a\u0430\u0437",
            product_question: "\u0422\u043e\u0432\u0430\u0440",
            complaint: "\u0416\u0430\u043b\u043e\u0431\u0430",
            support_request: "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430",
            finance_request: "\u0424\u0438\u043d\u0430\u043d\u0441\u044b"
        }[conversation.type] || conversation.type || "\u0414\u0438\u0430\u043b\u043e\u0433";
        const title = conversation.order ? `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(conversation.order)}` : conversation.product ? conversation.product.name : `#${conversation.id || ""}`;
        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, title),
                    h("p", { className: "react-muted" }, typeLabel)
                ]),
                ButtonLink({ href: "/conversations/", className: "secondary" }, "\u041a \u0434\u0438\u0430\u043b\u043e\u0433\u0430\u043c")
            ]),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438"), h("p", null, [conversation.buyer ? (conversation.buyer.full_name || conversation.buyer.email) : "-", " / ", conversation.farmer ? (conversation.farmer.farm_name || conversation.farmer.full_name || conversation.farmer.email) : "-"])]),
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"), h("p", null, conversation.status || "-")]),
                conversation.product && h("div", { className: "react-card" }, [h("b", null, "\u0422\u043e\u0432\u0430\u0440"), h("p", null, conversation.product.name)]),
                conversation.complaint && h("div", { className: "react-card" }, [h("b", null, "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435"), h("p", null, COMPLAINT_CATEGORY_LABELS[conversation.complaint.category] || conversation.complaint.category || "-")])
            ]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f"),
                messages.length ? h("div", { className: "react-chat-list" }, messages.map(message => h("div", { key: message.id, className: `react-chat-message${message.sender_id === (user && user.id) ? " own" : ""}` }, [
                    h("b", null, `${message.sender ? (message.sender.full_name || message.sender.farm_name || message.sender.email) : "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a"} В· ${message.sender_role || ""}`),
                    h("p", null, message.text),
                    h("span", { className: "react-muted" }, dateText(message.created_at))
                ]))) : h("div", { className: "react-empty" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438Р в„– Р С—Р С•Р С”Р В° Р Р…Р ВµРЎвЂљ."),
                props.can_reply && h("form", { action: `/conversations/${conversation.id}/message`, method: "post", encType: "multipart/form-data", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Textarea({ name: "text", placeholder: "\u041d\u0430Р С—Р С‘РЎЛ†Р С‘РЎвЂљР Вµ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ", className: "wide", rows: 4, required: true, maxLength: 2000 }),
                    h("input", { name: "attachment", type: "file", className: "react-input wide" }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u041eРЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ")
                ])
            ])
        ]);
    }
    function ComplaintDetailPage() {
        const complaint = props.complaint || {};
        const conversation = props.conversation || {};
        const messages = props.messages || [];
        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, `\u0416\u0430\u043b\u043e\u0431\u0430 #${complaint.id || ""}`),
                    h("p", { className: "react-muted" }, COMPLAINT_CATEGORY_LABELS[complaint.category] || complaint.category || complaint.type || "-")
                ]),
                ButtonLink({ href: "/complaints/admin", className: "secondary" }, "\u041a \u0441Р С—Р С‘РЎРѓР С”РЎС“")
            ]),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u0421РЎвЂљР В°РЎвЂљРЎС“РЎРѓ"), h("p", null, complaint.status || "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0410Р Т‘РЎР‚Р ВµРЎРѓР В°РЎвЂљ"), h("p", null, complaint.assigned_to_role || "-")]),
                complaint.order_id && h("div", { className: "react-card" }, [h("b", null, "\u0417Р В°Р С”Р В°Р В·"), h("p", null, `#${complaint.order_id}`)]),
                complaint.target_user_id && h("div", { className: "react-card" }, [h("b", null, "\u0424Р ВµРЎР‚Р СР ВµРЎР‚"), h("p", null, `${complaint.target_user_id}`)])
            ]),
            h("div", { className: "react-panel" }, h("p", null, complaint.text || complaint.description || "")),
            complaint.admin_response && h("div", { className: "react-panel" }, [h("b", null, "Ответ"), h("p", null, complaint.admin_response)]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "Сообщения"),
                messages.length ? h("div", { className: "react-chat-list" }, messages.map(message => h("div", { key: message.id, className: `react-chat-message${message.sender_id === (user && user.id) ? " own" : ""}` }, [
                    h("b", null, `${message.sender ? (message.sender.full_name || message.sender.farm_name || message.sender.email) : "Участник"} · ${message.sender_role || ""}`),
                    h("p", null, message.text),
                    h("span", { className: "react-muted" }, dateText(message.created_at))
                ]))) : h("div", { className: "react-empty" }, "Сообщений пока нет."),
                h("div", { className: "react-actions" }, [
                    props.can_reply && h("form", { action: `/conversations/${conversation.id}/message`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                        Textarea({ name: "text", placeholder: "Ответить", className: "wide", rows: 4, required: true, maxLength: 2000 }),
                        h("button", { className: "react-btn wide", type: "submit" }, "Ответить")
                    ]),
                    props.can_transfer && PostButton({ action: `/complaints/admin/${complaint.id}/transfer`, children: "Передать бухгалтеру", className: "react-btn secondary" }),
                    props.can_status && h("form", { action: `/complaints/status/${complaint.id}`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                        Select({ name: "status", defaultValue: complaint.status }, ["new", "processing", "in_progress", "waiting_farmer", "sent_to_accountant", "resolved", "rejected", "closed"].map(status => h("option", { value: status }, status))),
                        Textarea({ name: "response_text", placeholder: "\u0421Р В»РЎС“Р В¶Р ВµР В±Р Р…РЎвЂ№Р в„– \u043aР С•Р СР СР ВµР Р…РЎвЂљР В°РЎР‚Р С‘Р в„–", className: "wide", rows: 3, defaultValue: complaint.admin_response || "" }),
                        h("button", { className: "react-btn wide", type: "submit" }, "\u0421Р С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ")
                    ])
                ])
            ])
        ]);
    }
    function SellerSupportPage() {
        const tickets = props.tickets || [];
        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u041f\u043eР Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р В°"),
                ButtonLink({ href: "/seller/", className: "secondary" }, "\u041a \u043aР В°Р В±Р С‘Р Р…Р ВµРЎвЂљРЎС“")
            ]),
            h("form", { action: "/seller/support/create", method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                Select({ name: "topic", defaultValue: "other" }, [
                    h("option", { value: "moderation" }, "\u041c\u043eР Т‘Р ВµРЎР‚Р В°РЎвЂ Р С‘РЎРЏ \u043fРЎР‚Р С•РЎвЂћР С‘Р В»РЎРЏ/\u0442Р С•Р Р†Р В°РЎР‚Р В°"),
                    h("option", { value: "documents" }, "\u0414Р С•Р С”РЎС“Р СР ВµР Р…РЎвЂљРЎвЂ№ \u043fР С•РЎРѓРЎвЂљР В°Р Р†РЎвЂ°Р С‘Р С”Р В°"),
                    h("option", { value: "certificates" }, "\u0421Р ВµРЎР‚РЎвЂљР С‘РЎвЂћР С‘Р С”Р В°РЎвЂљРЎвЂ№"),
                    h("option", { value: "block" }, "\u0411Р В»Р С•Р С”Р С‘РЎР‚Р С•Р Р†Р С”Р В°"),
                    h("option", { value: "commission" }, "\u041aР С•Р СР С‘РЎРѓРЎРѓР С‘РЎРЏ \u043fР В»Р В°РЎвЂљРЎвЂћР С•РЎР‚Р СРЎвЂ№"),
                    h("option", { value: "other" }, "\u0414РЎР‚РЎС“Р С–Р С•Р Вµ")
                ]),
                Textarea({ name: "text", placeholder: "\u041eР С—Р С‘РЎв‚¬Р С‘РЎвЂљР Вµ Р С•Р В±РЎР‚Р В°РЎвЂ°Р ВµР Р…Р С‘Р Вµ", className: "wide", rows: 4, required: true, minLength: 10, maxLength: 2000 }),
                h("button", { className: "react-btn wide", type: "submit" }, "\u0421Р С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ \u043eР В±РЎР‚Р В°РЎвЂ°Р ВµР Р…Р С‘Р Вµ")
            ]),
            tickets.length ? h("div", { className: "react-stack" }, tickets.map(ticket => h("div", { key: ticket.id, className: "react-card" }, [
                h("b", null, `#${ticket.id}`),
                h("p", null, COMPLAINT_CATEGORY_LABELS[ticket.category] || ticket.category || ticket.type),
                h("p", null, ticket.text),
                h("div", { className: "react-actions" }, [
                    ButtonLink({ href: `/conversations/${ticket.conversation_id || ticket.id}`, className: "secondary" }, "\u041eРЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ")
                ])
            ]))) : h("div", { className: "react-empty" }, "\u041eР В±РЎР‚Р В°РЎвЂ°Р ВµР Р…Р С‘Р в„– Р С—Р С•Р С”Р В° Р Р…Р ВµРЎвЂљ.")
        ]);
    }
    function AccountingRequestPage() {
        const complaint = props.complaint || {};
        const order = props.order || {};
        const messages = props.messages || [];
        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, `\u0424Р С‘Р Р…Р В°Р Р…РЎРѓР С•Р Р†Р С•Р Вµ \u043eР В±РЎР‚Р В°РЎвЂ°Р ВµР Р…Р С‘Р Вµ #${complaint.id || ""}`),
                    h("p", { className: "react-muted" }, COMPLAINT_CATEGORY_LABELS[complaint.category] || complaint.category || "")
                ]),
                ButtonLink({ href: "/accounting/", className: "secondary" }, "\u041a \u0431\u0443\u0445Р С–Р В°Р В»РЎвЂљР ВµРЎР‚Р С‘Р С‘")
            ]),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u0421Р С—Р С•РЎРѓР С•Р В±"), h("p", null, complaint.status || "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0417Р В°Р С”Р В°Р В·"), h("p", null, orderDisplayNumber(order) || complaint.order_id || "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0421РЎС“Р СР СР В°"), h("p", null, money(order.total_price || 0))]),
                h("div", { className: "react-card" }, [h("b", null, "\u041aР С•Р СР С‘РЎРѓРЎРѓР С‘РЎРЏ"), h("p", null, money(order.platform_fee || 0))])
            ]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "Сообщения"),
                messages.length ? h("div", { className: "react-chat-list" }, messages.map(message => h("div", { key: message.id, className: "react-chat-message" }, [
                    h("b", null, `${message.sender ? (message.sender.full_name || message.sender.farm_name || message.sender.email) : "Участник"} · ${message.sender_role || ""}`),
                    h("p", null, message.text),
                    h("span", { className: "react-muted" }, dateText(message.created_at))
                ]))) : h("div", { className: "react-empty" }, "Сообщений пока нет."),
                h("form", { action: `/accounting/requests/${complaint.id}/comment`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Textarea({ name: "text", placeholder: "Комментарий", className: "wide", rows: 3, maxLength: 2000 }),
                    h("button", { className: "react-btn wide", type: "submit" }, "Добавить комментарий")
                ]),
                h("div", { className: "react-actions" }, [
                    order.id ? PostButton({ action: `/accounting/orders/${order.id}/payout`, children: "Подтвердить выплату" }) : null,
                    order.id ? PostButton({ action: `/accounting/orders/${order.id}/refund`, children: "Возврат", className: "react-btn danger", confirmMessage: "Инициировать возврат?" }) : null
                ])
            ])
        ]);
    }
    function ProductTable({ products, seller }) {
        return h("section", { className: "react-panel" }, [
            h("h2", null, "\u0422\u043e\u0432\u0430\u0440\u044b"),
            h("table", { className: "react-table" }, h("tbody", null, (products || []).map(p => {
                const status = stockStatus(p);
                return h("tr", { key: p.id, className: `stock-row stock-${status}` }, [
                    h("td", null, A({ href: `/product/${p.id}` }, p.name)),
                    h("td", null, h(PriceDisplay, { product: p, compact: true, inline: true })),
                    h("td", null, p.category),
                    h("td", null, h("span", { className: `react-stock-pill stock-${status}` }, stockText(p))),
                    h("td", null, p.status || "approved"),
                    h("td", null, h("div", { className: "react-actions" }, [
                        seller && A({ href: `/seller/product/edit/${p.id}`, className: "react-btn secondary" }, "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c"),
                        PostButton({ action: `${seller ? "/seller" : "/admin"}/product/delete/${p.id}`, children: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440?" })
                    ]))
                ]);
            })))
        ]);
    }
    function SellerProfilePage() {
        const seller = props.seller || {};
        const approvedProducts = (props.products || []).filter(p => p && p.status === "approved");
        const title = seller.farm_name || seller.full_name || seller.farm_address || seller.email || "\u0424\u0435\u0440\u043c\u0435\u0440";
        const certificates = props.certificates || [];
        return h(React.Fragment, null, [
            h("section", { className: "react-panel react-seller-hero" }, [
                h("div", { className: "react-seller-hero-photo" }, seller.farm_photo_url ? h("img", { src: seller.farm_photo_url, alt: title }) : h(ProductPlaceholder, { product: { name: title, category: seller.farm_name || seller.full_name }, compact: false })),
                h("div", { className: "react-stack" }, [
                    h("div", { className: "react-page-title" }, [
                        h("h1", null, title),
                        props.avg_rating ? h("span", { className: "react-chip" }, `\u2605 ${props.avg_rating}`) : null
                    ]),
                    seller.farm_address && h("div", { className: "react-chip-row" }, [
                        h("span", { className: "react-chip" }, seller.farm_address),
                        seller.full_name && h("span", { className: "react-chip" }, seller.full_name)
                    ]),
                    seller.farm_description && h("p", { className: "react-muted" }, seller.farm_description)
                ])
            ]),
            h("section", { className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [h("h2", null, "\u041e \u0441\u0435\u0431\u0435")]),
                h("p", null, seller.about || seller.farm_description || "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f.")
            ]),
            certificates.length ? h("section", { className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [h("h2", null, "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u044b")]),
                h("div", { className: "react-cert-grid" }, certificates.map(cert => A({ key: cert.id, href: cert.image_url || "#", target: "_blank", className: "react-cert-card" }, [
                    cert.image_url ? h("img", { src: cert.image_url, alt: cert.title || "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442" }) : null,
                    h("b", null, cert.title || "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442")
                ])))
            ]) : null,
            h("section", { className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [h("h2", null, "\u041e\u0442\u0437\u044b\u0432\u044b")]),
                (props.reviews || []).length
                    ? h("div", { className: "react-stack" }, (props.reviews || []).map(r => h("div", { key: r.id, className: "react-card" }, [
                        h("div", null, "в…".repeat(r.rating || 5)),
                        h("p", null, r.text || "")
                    ])))
                    : h("div", { className: "react-empty" }, "\u041e\u0442\u0437\u044b\u0432\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
            ]),
            h("section", { className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [h("h2", null, "\u041f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u044f")]),
                h(ProductsGrid, { products: approvedProducts })
            ])
        ]);
    }
    function SellerEditPage() {
        const product = props.product || {};
        return h(React.Fragment, null, [h("h1", null, "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u0430"), h(ProductForm, { action: `/seller/product/edit/${product.id}`, product })]);
    }
    function TransactionsPage() {
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, h("h1", null, "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0439")),
            h(TransactionsTable, { transactions: props.transactions || [] })
        ]);
    }
    function orderSellers(order) {
        const seen = new Set();
        const sellers = [];
        (order.items || []).forEach(item => {
            const product = item.product;
            const owner = product && product.owner;
            if (!owner || !owner.id || seen.has(owner.id)) return;
            seen.add(owner.id);
            sellers.push(owner);
        });
        return sellers;
    }
    function SellerReviewForms({ order }) {
        const reviewedKeys = new Set(props.reviewed_seller_keys || []);
        const sellers = orderSellers(order).filter(seller => !reviewedKeys.has(`${order.id}:${seller.id}`));
        if (!sellers.length || order.status !== "completed") return null;
        return h("section", { className: "react-panel react-stack", style: { marginTop: 16 } }, [
            h("h3", null, "\u041e\u0446\u0435\u043d\u0438\u0442\u044c \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430"),
            ...sellers.map(seller => h("form", {
                key: seller.id,
                action: "/reviews/seller/create",
                method: "post",
                className: "react-stack",
                onSubmit: handleSubmitOnce
            }, [
                h("input", { type: "hidden", name: "order_id", value: order.id }),
                h("input", { type: "hidden", name: "seller_id", value: seller.id }),
                h("b", null, seller.full_name || seller.email || "\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446"),
                Select({ name: "rating", defaultValue: "5" }, [
                    h("option", { value: "5" }, "5 - \u041e\u0442\u043b\u0438\u0447\u043d\u043e"),
                    h("option", { value: "4" }, "4 - \u0425\u043e\u0440\u043e\u0448\u043e"),
                    h("option", { value: "3" }, "3 - \u041d\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u043e"),
                    h("option", { value: "2" }, "2 - \u041f\u043b\u043e\u0445\u043e"),
                    h("option", { value: "1" }, "1 - \u041e\u0447\u0435\u043d\u044c \u043f\u043b\u043e\u0445\u043e")
                ]),
                Textarea({ name: "text", placeholder: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043e\u0442\u0437\u044b\u0432 \u043e \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0435", rows: 3, required: true, minLength: 5, maxLength: 2000 }),
                h("div", { className: "react-actions" }, [
                    h("button", { className: "react-btn", type: "submit" }, "\u041e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043e\u0442\u0437\u044b\u0432")
                ])
            ]))
        ]);
    }
    function ProductReviewForms({ order }) {
        const reviewedPairs = new Set((props.reviewed_pairs || []).map(pair => Array.isArray(pair) ? `${pair[0]}:${pair[1]}` : String(pair)));
        const items = (order.items || []).filter(item => item.product && !reviewedPairs.has(`${item.product.id}:${order.id}`));
        if (!items.length || order.status !== "completed") return null;
        return h("section", { className: "react-panel react-stack", style: { marginTop: 16 } }, [
            h("h3", null, "\u041e\u0442\u0437\u044b\u0432 \u043d\u0430 \u0442\u043e\u0432\u0430\u0440"),
            ...items.map(item => h("form", { key: item.id, action: "/reviews/create", method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                h("input", { type: "hidden", name: "order_id", value: order.id }),
                h("input", { type: "hidden", name: "product_id", value: item.product.id }),
                h("b", null, item.product.name),
                Select({ name: "rating", defaultValue: "5" }, [
                    h("option", { value: "5" }, "5 - \u041e\u0442\u043b\u0438\u0447\u043d\u043e"),
                    h("option", { value: "4" }, "4 - \u0425\u043e\u0440\u043e\u0448\u043e"),
                    h("option", { value: "3" }, "3 - \u041d\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u043e"),
                    h("option", { value: "2" }, "2 - \u041f\u043b\u043e\u0445\u043e"),
                    h("option", { value: "1" }, "1 - \u041e\u0447\u0435\u043d\u044c \u043f\u043b\u043e\u0445\u043e")
                ]),
                Textarea({ name: "text", placeholder: "\u041e\u0442\u0437\u044b\u0432 \u043e \u0442\u043e\u0432\u0430\u0440\u0435", rows: 3, required: true, minLength: 5, maxLength: 2000 }),
                h("button", { className: "react-btn", type: "submit" }, "\u041e\u0441\u0442\u0430\u0432\u0438\u0442\u044c")
            ]))
        ]);
    }
    function OrdersPage() {
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, h("h1", null, "\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b")),
            props.order_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.order_success),
            props.payment_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.payment_success),
            props.payment_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.payment_error),
            (props.orders || []).length ? (props.orders || []).map(order => {
                const items = order.items || [];
                const goodsTotal = items.reduce((sum, item) => sum + (item.product ? productFinalPrice(item.product) * Number(item.quantity || 0) : 0), 0);
                const discount = Number(order.discount_amount || 0);
                const deliveryPrice = deliveryPriceValue(order.delivery_method);
                const delivery = order.delivery || {};
                const trackNumber = order.track_number || delivery.track_number;
                const trackingUrl = delivery.tracking_url || (trackNumber ? `/delivery/track/${trackNumber}` : "");
                const deliveryProvider = delivery.provider || "";
                return h("section", { key: order.id, className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [
                    h("div", null, [h("h2", null, `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(order)}`), h("p", { className: "react-muted" }, dateText(order.created_at))]),
                    h("strong", null, h(PriceDisplay, { product: { price: order.total_price }, compact: true, inline: true }))
                ]),
                h("div", { className: "react-chip-row" }, [
                    h("span", { className: `react-chip react-status-chip status-${order.status || "created"}` }, orderStatusText(order, props.status_labels)),
                    h("span", { className: `react-chip react-status-chip payment-${order.payment_status || "pending"}` }, `\u041e\u043f\u043b\u0430\u0442\u0430: ${paymentStatusText(order.payment_status)}`),
                    h("span", { className: `react-chip react-status-chip delivery-${order.status || "created"}` }, `\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430: ${deliveryStatusText(order)}`)
                ]),
                h("div", { className: "react-info-grid react-order-meta-grid" }, [
                    h("div", { className: "react-card" }, [h("b", null, "\u041f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044c"), h("p", null, order.customer_name || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"), h("p", { className: "react-muted" }, order.customer_phone || "")]),
                    h("div", { className: "react-card" }, [h("b", null, "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"), h("p", null, deliveryMethodText(order.delivery_method) || "\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430"), h("p", { className: "react-muted" }, order.delivery_address || "\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437"), order.delivery_slot ? h("p", { className: "react-muted" }, order.delivery_slot) : null, h("p", { className: "react-muted" }, `\u0422\u0440\u0435\u043a-\u043d\u043e\u043c\u0435\u0440: ${trackNumber || "\u043d\u0435\u0442"}`)]),
                    (deliveryProvider || trackNumber) ? h("div", { className: "react-card react-logistics-card" }, [h("b", null, "Логистика"), h("p", null, deliveryProvider || "Служба доставки"), trackNumber ? h("p", { className: "react-track-number" }, `Трек: ${trackNumber}`) : null, trackNumber ? ButtonLink({ href: trackingUrl, className: "secondary" }, "Отследить") : null]) : null,
                    h("div", { className: "react-card" }, [h("b", null, "\u041e\u043f\u043b\u0430\u0442\u0430"), h("p", null, paymentMethodText(order.selected_payment_method) || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"), h("p", { className: "react-muted" }, paymentStatusText(order.payment_status)), order.customer_comment ? h("p", { className: "react-muted" }, order.customer_comment) : null]),
                    h("div", { className: "react-card" }, [h("b", null, "\u0421\u0443\u043c\u043c\u044b"), h("p", null, `\u0422\u043e\u0432\u0430\u0440\u044b: ${money(goodsTotal)}`), discount > 0 ? h("p", { className: "react-muted" }, `\u0421\u043a\u0438\u0434\u043a\u0430: -${money(discount)}`) : null, h("p", { className: "react-muted" }, `\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430: ${money(deliveryPrice)}`), h("p", { className: "react-price" }, `\u0418\u0442\u043e\u0433: ${money(order.total_price)}`)])
                ]),
                order.seller_cancel_reason && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, `\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043c\u0435\u043d\u044b: ${order.seller_cancel_reason}`),
                h("table", { className: "react-table" }, h("tbody", null, items.map(item => h("tr", { key: item.id }, [h("td", null, item.product ? h(ProductMiniPreview, { product: item.product }) : "\u0422\u043e\u0432\u0430\u0440"), h("td", null, item.quantity), h("td", null, item.product ? h(PriceDisplay, { product: item.product, compact: true, inline: true }) : ""), h("td", null, item.product ? money(productFinalPrice(item.product) * Number(item.quantity || 0)) : "")])))),
                h("div", { className: "react-actions" }, [
                    order.payment_status === "pending" && order.selected_payment_method === "yookassa" && ButtonLink({ href: `/payment/${order.id}` }, "\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c"),
                    order.payment_status === "pending" && order.selected_payment_method === "wallet" && PostButton({ action: `/order/${order.id}/pay`, children: "\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c" }),
                    order.payment_status === "pending" && order.status === "created" && h(CancelOrderButton, { action: `/order/${order.id}/cancel`, children: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c" }),
                    ["paid", "assembling", "delivering"].includes(order.status) && PostButton({ action: `/order/${order.id}/complete`, children: "\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e", confirmMessage: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0437\u0430\u043a\u0430\u0437\u0430?" }),
                    PostButton({ action: `/order/${order.id}/repeat`, children: "\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437", className: "react-btn secondary" }),
                    ButtonLink({ href: `/order/${order.id}/receipt`, className: "secondary" }, "\u041a\u0432\u0438\u0442\u0430\u043d\u0446\u0438\u044f"),
                    user && user.role === "user" && (order.items || []).reduce((acc, item) => {
                        const owner = item.product && item.product.owner;
                        if (owner && !acc.some(entry => entry.id === owner.id)) acc.push(owner);
                        return acc;
                    }, []).map(owner => ButtonLink({ key: owner.id, href: `/conversations/order/${order.id}?seller_id=${owner.id}`, className: "secondary" }, owner ? `\u0417\u0430\u0434\u0430\u0442\u044c \u0432\u043e\u043f\u0440\u043e\u0441 \u0444\u0435\u0440\u043c\u0435\u0440\u0443${(order.items || []).filter(item => item.product && item.product.owner_id === owner.id).length > 1 ? `: ${owner.farm_name || owner.full_name || owner.email}` : ""}` : "\u0417\u0430\u0434\u0430\u0442\u044c \u0432\u043e\u043f\u0440\u043e\u0441")),
                    user && user.role === "user" && ButtonLink({ href: `/complaints/create?order_id=${order.id}`, className: "secondary" }, "\u0421\u043e\u043e\u0431\u0449\u0438\u0442\u044c \u043e \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0435")
                ]),
                h(ProductReviewForms, { order }),
                h(SellerReviewForms, { order })
            ]);
            }) : h("div", { className: "react-empty react-panel" }, "\u0417\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    function ProfilePage() {
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, h("h1", null, "\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442")),
            props.profile_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.profile_success),
            h("section", { className: "react-panel" }, [
                h("h2", null, "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b"),
                h("form", { action: "/profile/update", method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Field({ name: "full_name", placeholder: "\u0418\u043c\u044f", defaultValue: user && user.full_name || "", maxLength: 255 }),
                    Field({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: user && user.phone || "", maxLength: 50 }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c")
                ])
            ]),
            h("div", { className: "react-actions", style: { marginTop: 16 } }, [
                ButtonLink({ href: "/complaints/my", className: "secondary" }, "\u041c\u043e\u0438 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f"),
                ButtonLink({ href: "/conversations/", className: "secondary" }, "\u041c\u043e\u0438 \u0447\u0430\u0442\u044b")
            ]),
            h(OrdersPage)
        ]);
    }
    function SellerStatusActions(order) {
        const status = order.status || "created";
        const actions = [];
        if (["created"].includes(status)) {
            actions.push({ action: "confirm", label: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c", className: "react-btn" });
            actions.push({ action: "assemble", label: "\u041d\u0430\u0447\u0430\u0442\u044c \u0441\u0431\u043e\u0440\u043a\u0443", className: "react-btn secondary" });
            actions.push({ action: "cancel", label: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437?" });
        } else if (["confirmed", "paid"].includes(status)) {
            actions.push({ action: "assemble", label: "\u041d\u0430\u0447\u0430\u0442\u044c \u0441\u0431\u043e\u0440\u043a\u0443", className: "react-btn" });
            actions.push({ action: "cancel", label: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437?" });
        } else if (status === "assembling") {
            actions.push({ action: "ship", label: "\u041f\u0435\u0440\u0435\u0434\u0430\u0442\u044c \u0432 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443", className: "react-btn" });
            actions.push({ action: "cancel", label: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437?" });
        } else if (status === "shipped") {
            actions.push({ action: "deliver", label: "\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u043a\u0430\u043a \u0434\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442\u0441\u044f", className: "react-btn" });
        }
        if (!actions.length) return null;
        return h("div", { className: "react-stack" }, [
            actions.some(item => item.action === "cancel") && h("form", {
                key: "cancel-form",
                action: `/seller/orders/${order.id}/status`,
                method: "post",
                className: "react-panel react-stack",
                onSubmit: confirmSubmit("\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437?")
            }, [
                h("input", { type: "hidden", name: "action", value: "cancel" }),
                Textarea({ name: "cancel_reason", placeholder: "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043c\u0435\u043d\u044b \u0434\u043b\u044f \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044f", rows: 3, required: true, minLength: 5, maxLength: 2000 }),
                h("button", { type: "submit", className: "react-btn danger" }, "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437")
            ]),
            h("div", { key: "actions", className: "react-actions" }, actions.filter(item => item.action !== "cancel").map(item =>
            h("form", { key: item.action, action: `/seller/orders/${order.id}/status`, method: "post", className: "react-inline-form", onSubmit: item.confirmMessage ? confirmSubmit(item.confirmMessage) : handleSubmitOnce }, [
                h("input", { type: "hidden", name: "action", value: item.action }),
                h("button", { type: "submit", className: item.className }, item.label)
            ])
        ))
        ]);
    }
    function SellerOrdersPage() {
        const orders = props.orders || [];
        const [statusFilter, setStatusFilter] = React.useState("all");
        const counts = orders.reduce((acc, order) => {
            const status = order.status || "created";
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        const filteredOrders = orders.filter(order => statusFilter === "all" ? true : (order.status || "created") === statusFilter);
        const filters = [
            { id: "all", label: "\u0412\u0441\u0435" },
            { id: "created", label: "\u041d\u043e\u0432\u044b\u0435" },
            { id: "confirmed", label: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043d\u044b\u0435" },
            { id: "assembling", label: "\u0421\u0431\u043e\u0440\u043a\u0430" },
            { id: "shipped", label: "\u0412 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435" },
            { id: "delivering", label: "\u0412 \u043f\u0443\u0442\u0438" },
            { id: "canceled", label: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0435" }
        ];
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u0417\u0430\u043a\u0430\u0437\u044b \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430"),
                ButtonLink({ href: "/seller/", className: "secondary" }, "\u041a \u043a\u0430\u0431\u0438\u043d\u0435\u0442\u0443")
            ]),
            props.seller_order_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.seller_order_success),
            props.seller_order_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.seller_order_error),
            h("div", { className: "react-stat-grid" }, [
                h("div", { className: "react-card" }, [h("h2", null, orders.length), h("p", null, "\u0412\u0441\u0435\u0433\u043e \u0437\u0430\u043a\u0430\u0437\u043e\u0432")]),
                h("div", { className: "react-card" }, [h("h2", null, counts.created || 0), h("p", null, "\u041d\u043e\u0432\u044b\u0435")]),
                h("div", { className: "react-card" }, [h("h2", null, counts.assembling || 0), h("p", null, "\u0421\u043e\u0431\u0438\u0440\u0430\u044e\u0442\u0441\u044f")]),
                h("div", { className: "react-card" }, [h("h2", null, counts.delivering || 0), h("p", null, "\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u044e\u0442\u0441\u044f")])
            ]),
            h("div", { className: "react-tab-row" }, filters.map(item => h("button", {
                key: item.id,
                type: "button",
                className: `react-btn ${statusFilter === item.id ? "" : "secondary"}`,
                onClick: () => setStatusFilter(item.id)
            }, item.label))),
            filteredOrders.length ? filteredOrders.map(order => h("section", { key: order.id, className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [
                    h("h2", null, `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(order)}`),
                    h("strong", null, money(order.seller_total))
                ]),
                h("div", { className: "react-chip-row" }, [
                    h("span", { className: `react-chip react-status-chip status-${order.status || "created"}` }, (props.status_labels && props.status_labels[order.status]) || order.status || "created"),
                    h("span", { className: `react-chip react-status-chip payment-${order.payment_status || "pending"}` }, `\u041e\u043f\u043b\u0430\u0442\u0430: ${order.payment_status || "pending"}`)
                ]),
                h("div", { className: "react-info-grid react-order-meta-grid" }, [
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c"),
                        h("p", null, order.customer_name || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"),
                        h("p", { className: "react-muted" }, order.customer_phone || "")
                    ]),
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"),
                        h("p", null, deliveryMethodText(order.delivery_method) || "\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430"),
                        h("p", { className: "react-muted" }, order.delivery_address || "\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437"),
                        order.delivery_slot ? h("p", { className: "react-muted" }, order.delivery_slot) : null,
                        order.delivery_provider ? h("p", { className: "react-muted" }, `Логистика: ${order.delivery_provider}`) : null,
                        order.delivery_track_number ? h("p", { className: "react-muted" }, `Трек: ${order.delivery_track_number}`) : null,
                        order.delivery_track_number ? ButtonLink({ href: order.delivery_tracking_url || `/delivery/track/${order.delivery_track_number}`, className: "secondary" }, "Отследить") : null
                    ]),
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u041e\u043f\u043b\u0430\u0442\u0430"),
                        h("p", null, paymentMethodText(order.selected_payment_method) || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"),
                        order.customer_comment ? h("p", { className: "react-muted" }, order.customer_comment) : null
                    ])
                ]),
                order.seller_cancel_reason && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, `\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043c\u0435\u043d\u044b: ${order.seller_cancel_reason}`),
                h("table", { className: "react-table" }, h("tbody", null, (order.items || []).map(item => h("tr", { key: item.id }, [
                    h("td", null, item.product ? h(ProductMiniPreview, { product: item.product }) : "\u0422\u043e\u0432\u0430\u0440"),
                    h("td", null, item.quantity),
                    h("td", null, item.product ? h(PriceDisplay, { product: item.product, compact: true, inline: true }) : ""),
                    h("td", null, money(item.item_total))
                ])))),
                h("div", { className: "react-actions" }, [
                    ButtonLink({ href: `/conversations/order/${order.id}`, className: "secondary" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u043f\u043e \u0437\u0430\u043a\u0430\u0437\u0443")
                ]),
                h(SellerStatusActions, order)
            ])) : h("div", { className: "react-empty react-panel" }, "\u0417\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c\u0443 \u0441\u0442\u0430\u0442\u0443\u0441\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    function WalletPage() {
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [h("h1", null, "\u041a\u043e\u0448\u0435\u043b\u0435\u043a"), h("strong", null, money(props.wallet && props.wallet.balance))]),
            h("div", { className: "react-info-grid" }, [
                h("form", { className: "react-panel react-stack", action: "/payment/wallet/deposit", method: "post", onSubmit: handleSubmitOnce }, [
                    h("h2", null, "\u041f\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u044c"),
                    Field({ name: "amount", type: "number", min: "1", step: "0.01", placeholder: "\u0421\u0443\u043c\u043c\u0430", required: true }),
                    Select({ name: "payment_method" }, [h("option", { value: "card" }, "\u041a\u0430\u0440\u0442\u0430"), h("option", { value: "sbp" }, "\u0421\u0411\u041f")]),
                    h("button", { className: "react-btn", type: "submit" }, "\u041f\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u044c")
                ]),
                h("form", { className: "react-panel react-stack", action: "/payment/wallet/withdraw", method: "post", onSubmit: handleSubmitOnce }, [
                    h("h2", null, "\u0412\u044b\u0432\u0435\u0441\u0442\u0438"),
                    Field({ name: "amount", type: "number", min: "1", max: props.wallet ? props.wallet.balance : undefined, step: "0.01", placeholder: "\u0421\u0443\u043c\u043c\u0430", required: true }),
                    h("button", { className: "react-btn secondary", type: "submit" }, "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443")
                ])
            ]),
            h(TransactionsTable, { transactions: props.transactions || [] })
        ]);
    }
    function TransactionsTable({ transactions }) {
        return h("section", { className: "react-panel" }, [
            h("div", { className: "react-page-title" }, [h("h2", null, "\u041e\u043f\u0435\u0440\u0430\u0446\u0438\u0438"), ButtonLink({ href: "/payment/transactions", className: "secondary" }, "\u0418\u0441\u0442\u043e\u0440\u0438\u044f")]),
            h("table", { className: "react-table" }, h("tbody", null, (transactions || []).map(t => h("tr", { key: t.id }, [h("td", null, dateText(t.created_at)), h("td", null, t.type), h("td", null, money(t.amount)), h("td", null, t.status), h("td", null, t.description || "")]))))
        ]);
    }
    function PaymentPage() {
        const order = props.order || {};
        const isYookassa = (order.selected_payment_method || "yookassa") === "yookassa";
        return h("section", { className: "react-panel", style: { maxWidth: 720, margin: "0 auto" } }, [
            h("h1", null, `\u041e\u043f\u043b\u0430\u0442\u0430 \u0437\u0430\u043a\u0430\u0437\u0430 ${orderDisplayNumber(order)}`),
            h("p", { className: "react-price" }, money(order.total_price)),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u041d\u043e\u043c\u0435\u0440 \u0437\u0430\u043a\u0430\u0437\u0430"), h("p", null, orderDisplayNumber(order))]),
                h("div", { className: "react-card" }, [h("b", null, "\u0418\u0442\u043e\u0433 \u043a \u043e\u043f\u043b\u0430\u0442\u0435"), h("p", null, money(order.total_price))]),
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u043f\u043e\u0441\u043e\u0431"), h("p", null, paymentMethodText(order.selected_payment_method) || "\u042eKassa")])
            ]),
            h("p", { className: "react-muted" }, isYookassa ? "\u041f\u043e\u0441\u043b\u0435 \u043d\u0430\u0436\u0430\u0442\u0438\u044f \u043c\u044b \u043e\u0442\u043a\u0440\u043e\u0435\u043c \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u043e\u043f\u043b\u0430\u0442\u044b \u042eKassa. \u041f\u043e\u0441\u043b\u0435 \u0443\u0441\u043f\u0435\u0445\u0430 \u0437\u0430\u043a\u0430\u0437 \u043f\u043e\u043c\u0435\u043d\u044f\u0435\u0442 \u0441\u0442\u0430\u0442\u0443\u0441 \u043d\u0430 \u00ab\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u00bb." : "\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0437\u0430\u043a\u0430\u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d \u0440\u0430\u0441\u0447\u0435\u0442 \u043f\u0440\u0438 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0438."),
            isYookassa ? h("form", { action: props.yookassa_ready ? `/payment/${order.id}/pay` : `/payment/${order.id}/demo`, method: props.yookassa_ready ? "post" : "get", className: "react-stack", onSubmit: handleSubmitOnce }, [
                h("input", { type: "hidden", name: "payment_method", value: "yookassa" }),
                h("button", { className: "react-btn" }, "\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u043e\u043f\u043b\u0430\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u042eKassa")
            ]) : h("div", { className: "react-actions" }, [
                ButtonLink({ href: "/order/orders", className: "secondary" }, "\u041a \u043c\u043e\u0438\u043c \u0437\u0430\u043a\u0430\u0437\u0430\u043c")
            ])
        ]);
    }
    function PaymentDemoPage() {
        const order = props.order || {};
        return h("section", { className: "react-panel", style: { maxWidth: 720, margin: "0 auto" } }, [
            h("h1", null, "\u0414\u0435\u043c\u043e-\u043e\u043f\u043b\u0430\u0442\u0430 \u042eKassa"),
            h("p", { className: "react-muted" }, `\u0417\u0430\u043a\u0430\u0437 #${order.id || ""}`),
            h("p", { className: "react-price" }, money(order.total_price)),
            h("p", null, "\u042d\u0442\u043e \u0437\u0430\u0433\u043b\u0443\u0448\u043a\u0430 \u0434\u043b\u044f \u0434\u0438\u043f\u043b\u043e\u043c\u0430: \u043f\u043e\u0441\u043b\u0435 \u043d\u0430\u0436\u0430\u0442\u0438\u044f \u0441\u0442\u0430\u0442\u0443\u0441 \u043e\u043f\u043b\u0430\u0442\u044b \u0441\u0442\u0430\u043d\u0435\u0442 \u00ab\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e\u00bb, \u0430 \u0437\u0430\u043a\u0430\u0437 - \u00ab\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u00bb."),
            h("form", { action: `/payment/${order.id}/demo/complete`, method: "post", className: "react-actions", onSubmit: handleSubmitOnce }, [
                h("button", { className: "react-btn" }, "\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c"),
                ButtonLink({ href: "/order/orders", className: "secondary" }, "\u041a \u043c\u043e\u0438\u043c \u0437\u0430\u043a\u0430\u0437\u0430\u043c")
            ])
        ]);
    }
    function ReceiptPage() {
        const order = props.order || {};
        const items = order.items || [];
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u041a\u0432\u0438\u0442\u0430\u043d\u0446\u0438\u044f"),
                h("strong", null, orderDisplayNumber(order))
            ]),
            h("section", { className: "react-panel", style: { maxWidth: 900 } }, [
                h("div", { className: "react-info-grid" }, [
                    h("div", { className: "react-card" }, [h("b", null, "\u041d\u043e\u043c\u0435\u0440 \u0437\u0430\u043a\u0430\u0437\u0430"), h("p", null, orderDisplayNumber(order))]),
                    h("div", { className: "react-card" }, [h("b", null, "\u0414\u0430\u0442\u0430"), h("p", null, dateText(order.created_at) || "-")]),
                    h("div", { className: "react-card" }, [h("b", null, "\u0421\u043f\u043e\u0441\u043e\u0431 \u043e\u043f\u043b\u0430\u0442\u044b"), h("p", null, paymentMethodText(order.selected_payment_method) || "-")]),
                    h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441 \u043e\u043f\u043b\u0430\u0442\u044b"), h("p", null, order.payment_status || "-")])
                ]),
                h("div", { className: "react-page-title", style: { marginTop: 20 } }, [
                    h("h2", null, "\u0421\u043e\u0441\u0442\u0430\u0432 \u0437\u0430\u043a\u0430\u0437\u0430"),
                    h("strong", null, money(order.total_price))
                ]),
                h("table", { className: "react-table" }, h("tbody", null, items.map(item => h("tr", { key: item.id }, [
                    h("td", null, item.product ? h(ProductMiniPreview, { product: item.product }) : "\u0422\u043e\u0432\u0430\u0440"),
                    h("td", null, item.quantity),
                    h("td", null, item.product ? h(PriceDisplay, { product: item.product, compact: true, inline: true }) : ""),
                    h("td", null, item.product ? money(productFinalPrice(item.product) * Number(item.quantity || 0)) : "")
                ])))),
                h("div", { className: "react-actions", style: { marginTop: 20 } }, [
                    ButtonLink({ href: "/order/orders", className: "secondary" }, "\u041a \u0437\u0430\u043a\u0430\u0437\u0430\u043c")
                ])
            ])
        ]);
    }
    function NotificationsPage() {
        return h("section", { className: "react-panel" }, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, page === "notifications_admin" ? "\u0420\u0430\u0441\u0441\u044b\u043b\u043a\u0438" : "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f"),
                page !== "notifications_admin" && PostButton({ action: "/notifications/mark-all-read", children: "\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0432\u0441\u0435", className: "react-btn secondary" })
            ]),
            page === "notifications_admin" && h("form", { action: "/notifications/admin/create", method: "post", className: "react-panel react-form-grid", onSubmit: handleSubmitOnce }, [Select({ name: "type" }, [h("option", { value: "email" }, "Email"), h("option", { value: "push" }, "Push")]), Field({ name: "subject", placeholder: "\u0422\u0435\u043c\u0430", required: true, maxLength: 500 }), Textarea({ name: "body", placeholder: "\u0422\u0435\u043a\u0441\u0442", className: "wide", required: true, maxLength: 4000 }), h("button", { className: "react-btn wide", type: "submit" }, "\u0421\u043e\u0437\u0434\u0430\u0442\u044c")]),
            (props.notifications || []).length
                ? h("div", { className: "react-stack" }, (props.notifications || []).map(n => h("div", { key: n.id, className: "react-card" }, [h("b", null, n.subject), h("p", null, n.body), h("span", { className: "react-muted" }, dateText(n.created_at))])))
                : h("div", { className: "react-empty" }, "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    function AdminHomePage() {
        const stats = props.stats || {};
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [h("h1", null, "\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435")]),
            h("div", { className: "react-stat-grid" }, [
                h("div", { className: "react-card" }, [h("h2", null, stats.complaints_new || 0), h("p", null, "\u041d\u043e\u0432\u044b\u0435 \u0436\u0430\u043b\u043e\u0431\u044b")]),
                h("div", { className: "react-card" }, [h("h2", null, stats.reviews_pending || 0), h("p", null, "\u041e\u0442\u0437\u044b\u0432\u044b \u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438")]),
                h("div", { className: "react-card" }, [h("h2", null, stats.products_pending || 0), h("p", null, "\u0422\u043e\u0432\u0430\u0440\u044b \u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435")]),
                h("div", { className: "react-card" }, [h("h2", null, money(stats.revenue_total)), h("p", null, "\u0412\u044b\u0440\u0443\u0447\u043a\u0430")]),
                h("div", { className: "react-card" }, [h("h2", null, stats.orders_total || 0), h("p", null, "\u0417\u0430\u043a\u0430\u0437\u044b")]),
                h("div", { className: "react-card" }, [h("h2", null, stats.users_total || 0), h("p", null, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0438")]),
                h("div", { className: "react-card" }, [h("h2", null, stats.sellers_total || 0), h("p", null, "\u0424\u0435\u0440\u043c\u0435\u0440\u044b")]),
                h("div", { className: "react-card" }, [h("h2", null, stats.products_total || 0), h("p", null, "\u0422\u043e\u0432\u0430\u0440\u044b")])
            ]),
            h("div", { className: "react-info-grid" }, [
                h("form", { className: "react-panel react-stack", action: "/admin/settings/commission", method: "post", onSubmit: handleSubmitOnce }, [
                    h("h2", null, "\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u0430\u044f \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044f"),
                    Field({ name: "commission_percent", type: "number", min: "0", max: "100", step: "0.01", defaultValue: stats.commission_percent || "7", placeholder: "\u041f\u0440\u043e\u0446\u0435\u043d\u0442" }),
                    h("button", { className: "react-btn", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c")
                ]),
                h("section", { className: "react-panel" }, [h("h2", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u0438"), h("p", { className: "react-price" }, money(stats.platform_fee_total))])
            ])
        ]);
    }
    function AdminOrdersTable({ orders, orderStatuses, statusLabels }) {
        const list = orders || [];
        if (!list.length) return h("div", { className: "react-empty react-panel" }, "\u0417\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.");
        return h("section", { className: "react-panel" }, [
            h("h2", null, "\u0417\u0430\u043a\u0430\u0437\u044b"),
            h("table", { className: "react-table" }, h("tbody", null, list.map(order => h("tr", { key: order.id }, [
                h("td", null, `#${order.id}`),
                h("td", null, h(PriceDisplay, { product: { price: order.total_price }, compact: true, inline: true })),
                h("td", null, statusLabels && statusLabels[order.status] ? statusLabels[order.status] : (order.status || "created")),
                h("td", null, order.payment_status || "pending"),
                h("td", null, h("form", { action: `/admin/order/status/${order.id}`, method: "post", className: "react-actions", onSubmit: handleSubmitOnce }, [
                    Select({ name: "status", defaultValue: order.status || "created" }, (orderStatuses || []).map(status => h("option", { key: status, value: status }, statusLabels && statusLabels[status] ? statusLabels[status] : status))),
                    h("button", { className: "react-btn secondary", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c")
                ]))
            ]))))
        ]);
    }
    function AdminUsersTable({ users }) {
        const list = users || [];
        return h("section", { className: "react-panel" }, [
            h("h2", null, "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438"),
            h("table", { className: "react-table" }, h("tbody", null, list.map(userItem => h("tr", { key: userItem.id }, [
                h("td", null, userItem.email),
                h("td", null, userItem.role),
                h("td", null, userItem.role === "seller" ? sellerApplicationStatusText(userItem.seller_application_status) : (userItem.is_approved ? "\u043e\u0434\u043e\u0431\u0440\u0435\u043d" : "\u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438")),
                h("td", null, h("form", { action: `/admin/user/role/${userItem.id}`, method: "post", className: "react-actions", onSubmit: handleSubmitOnce }, [
                    Select({ name: "role", defaultValue: userItem.role }, ["user", "seller", "admin", "accountant"].map(role => h("option", { key: role, value: role }, role))),
                    h("button", { className: "react-btn secondary", type: "submit" }, "\u0420\u043e\u043b\u044c")
                ])),
                h("td", null, userItem.role === "seller" && h("form", { action: `/admin/user/approve/${userItem.id}`, method: "post", className: "react-actions", onSubmit: handleSubmitOnce }, [
                    h("input", { type: "hidden", name: "approved", value: userItem.seller_application_status === "approved" ? "0" : "1" }),
                    h("button", { className: `react-btn ${userItem.seller_application_status === "approved" ? "danger" : "secondary"}`, type: "submit" }, userItem.seller_application_status === "approved" ? "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c" : "\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c")
                ]))
            ]))))
        ]);
    }
    function AdminProductsTable({ products }) {
        const list = products || [];
        return h("section", { className: "react-panel" }, [
            h("h2", null, "\u0422\u043e\u0432\u0430\u0440\u044b"),
            h("table", { className: "react-table" }, h("tbody", null, list.map(product => h("tr", { key: product.id }, [
                h("td", null, A({ href: `/product/${product.id}` }, product.name)),
                h("td", null, h(PriceDisplay, { product, compact: true, inline: true })),
                h("td", null, product.category || "-"),
                h("td", null, product.status || "approved"),
                h("td", null, h("div", { className: "react-actions" }, [
                    PostButton({ action: `/admin/product/delete/${product.id}`, children: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440?" })
                ]))
            ]))))
        ]);
    }
    function AdminManagePage() {
        const [tab, setTab] = React.useState("products");
        const tabs = [
            { id: "products", label: "\u0422\u043e\u0432\u0430\u0440\u044b" },
            { id: "users", label: "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438" },
            { id: "orders", label: "\u0417\u0430\u043a\u0430\u0437\u044b" },
            { id: "add", label: "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440" }
        ];
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [h("h1", null, "\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435")]),
            props.admin_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.admin_error),
            h("div", { className: "react-tab-row" }, tabs.map(item => h("button", {
                key: item.id,
                type: "button",
                className: `react-btn ${tab === item.id ? "" : "secondary"}`,
                onClick: () => setTab(item.id)
            }, item.label))),
            tab === "products" && h(AdminProductsTable, { products: props.products || [] }),
            tab === "users" && h(AdminUsersTable, { users: props.users || [] }),
            tab === "orders" && h(AdminOrdersTable, { orders: props.orders || [], orderStatuses: props.order_statuses || [], statusLabels: props.status_labels || {} }),
            tab === "add" && h("section", { className: "react-panel" }, [
                h("h2", null, "\u041d\u043e\u0432\u044b\u0439 \u0442\u043e\u0432\u0430\u0440"),
                h(ProductForm, { action: "/admin/product/add", admin: true })
            ])
        ]);
    }
    function ModerationPage() {
        const pendingProducts = props.pending_products || [];
        const pendingSellers = props.pending_sellers || [];
        const [tab, setTab] = React.useState("products");
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [h("h1", null, "\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f")]),
            h("div", { className: "react-tab-row" }, [
                h("button", { type: "button", className: `react-btn ${tab === "products" ? "" : "secondary"}`, onClick: () => setTab("products") }, "\u0422\u043e\u0432\u0430\u0440\u044b"),
                h("button", { type: "button", className: `react-btn ${tab === "sellers" ? "" : "secondary"}`, onClick: () => setTab("sellers") }, "\u0424\u0435\u0440\u043c\u0435\u0440\u044b")
            ]),
            tab === "products" && h(React.Fragment, null, [
                h("section", { className: "react-panel" }, [
                    h("h2", null, "\u0422\u043e\u0432\u0430\u0440\u044b \u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435"),
                    pendingProducts.length ? h("table", { className: "react-table" }, h("tbody", null, pendingProducts.map(product => h("tr", { key: product.id }, [
                        h("td", null, A({ href: `/product/${product.id}` }, product.name)),
                        h("td", null, ownerName(product)),
                        h("td", null, h("div", { className: "react-actions" }, [
                            PostButton({ action: `/admin/product/approve/${product.id}`, children: "\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c" }),
                            h("form", { action: `/admin/product/reject/${product.id}`, method: "post", className: "react-inline-form", onSubmit: handleSubmitOnce }, [
                                h("input", { type: "hidden", name: "reason", value: "\u041d\u0435 \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043f\u0440\u0430\u0432\u0438\u043b\u0430\u043c \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b" }),
                                h("button", { className: "react-btn danger", type: "submit" }, "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c")
                            ])
                        ]))
                    ])))) : h("div", { className: "react-empty" }, "\u041d\u0435\u0442 \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435.")
                ]),
                h(AdminProductsTable, { products: props.products || [] })
            ]),
            tab === "sellers" && h("section", { className: "react-panel" }, [
                h("h2", null, "\u0424\u0435\u0440\u043c\u0435\u0440\u044b \u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435"),
                pendingSellers.length ? h("div", { className: "react-stack" }, pendingSellers.map(seller => h("article", { key: seller.id, className: "react-card react-seller-application-card" }, [
                    h("div", { className: "react-seller-application-grid" }, [
                        h("div", { key: "passport", className: "react-stack" }, [
                            h("b", null, "\u0424\u043e\u0442\u043e \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430"),
                            seller.passport_photo_url
                                ? h("img", { src: seller.passport_photo_url, alt: "\u041f\u0430\u0441\u043f\u043e\u0440\u0442", className: "react-passport-large" })
                                : h("span", { className: "react-muted" }, "\u0424\u043e\u0442\u043e \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e")
                        ]),
                        h("div", { key: "info", className: "react-stack" }, [
                            h("div", { className: "react-chip-row" }, [
                                h("span", { className: "react-chip" }, sellerApplicationStatusText(seller.seller_application_status)),
                                h("span", { className: "react-chip" }, `ID ${seller.id}`)
                            ]),
                            h("div", { className: "react-info-grid" }, [
                                h("div", { className: "react-card" }, [h("b", null, "\u0424\u0418\u041e"), h("div", null, seller.full_name || "-")]),
                                h("div", { className: "react-card" }, [h("b", null, "Email"), h("div", null, seller.email || "-")]),
                                h("div", { className: "react-card" }, [h("b", null, "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0444\u0435\u0440\u043c\u044b"), h("div", null, seller.farm_name || "-")]),
                                h("div", { className: "react-card" }, [h("b", null, "\u0422\u0435\u043b\u0435\u0444\u043e\u043d"), h("div", null, seller.phone || "-")]),
                                h("div", { className: "react-card" }, [h("b", null, "\u0418\u041d\u041d"), h("div", null, seller.inn || "-")]),
                                h("div", { className: "react-card" }, [h("b", null, "\u0410\u0434\u0440\u0435\u0441 / \u0440\u0435\u0433\u0438\u043e\u043d"), h("div", null, seller.farm_address || "-")])
                            ]),
                            h("div", { className: "react-card" }, [
                                h("b", null, "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"),
                                h("p", { className: "react-muted" }, seller.farm_description || "\u041d\u0435\u0442 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f")
                            ]),
                            seller.seller_application_rejection_reason ? h("div", { className: "alert alert-danger" }, seller.seller_application_rejection_reason) : null,
                            h("div", { className: "react-actions" }, [
                                h("form", { action: `/admin/user/approve/${seller.id}`, method: "post", className: "react-inline-form", onSubmit: handleSubmitOnce }, [
                                    h("input", { type: "hidden", name: "approved", value: "1" }),
                                    h("button", { className: "react-btn", type: "submit" }, "\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c")
                                ]),
                                h("form", { action: `/admin/user/approve/${seller.id}`, method: "post", className: "react-inline-form", onSubmit: handleSubmitOnce }, [
                                    h("input", { type: "hidden", name: "approved", value: "0" }),
                                    h("button", { className: "react-btn danger", type: "submit" }, "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c")
                                ])
                            ])
                        ])
                    ])
                ]))) : h("div", { className: "react-empty" }, "\u041d\u0435\u0442 \u0444\u0435\u0440\u043c\u0435\u0440\u043e\u0432 \u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435.")
            ])
        ]);
    }
    function AnalyticsPage() {
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [h("h1", null, "\u041e\u0442\u0447\u0435\u0442\u044b")]),
            h("form", { action: "/admin/analytics/", method: "get", className: "react-panel react-form-grid" }, [
                Field({ name: "date_from", type: "date", defaultValue: props.date_from || "" }),
                Field({ name: "date_to", type: "date", defaultValue: props.date_to || "" }),
                h("button", { className: "react-btn", type: "submit" }, "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c"),
                ButtonLink({ href: `/admin/analytics/export.csv?date_from=${encodeURIComponent(props.date_from || "")}&date_to=${encodeURIComponent(props.date_to || "")}`, className: "secondary" }, "CSV")
            ]),
            h("div", { className: "react-stat-grid" }, [
                h("div", { className: "react-card" }, [h("h2", null, props.total_orders || 0), h("p", null, "\u0417\u0430\u043a\u0430\u0437\u043e\u0432")]),
                h("div", { className: "react-card" }, [h("h2", null, money(props.total_revenue)), h("p", null, "\u0412\u044b\u0440\u0443\u0447\u043a\u0430")]),
                h("div", { className: "react-card" }, [h("h2", null, money(props.total_platform_fee)), h("p", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f")]),
                h("div", { className: "react-card" }, [h("h2", null, money(props.avg_order_value)), h("p", null, "\u0421\u0440\u0435\u0434\u043d\u0438\u0439 \u0447\u0435\u043a")])
            ])
        ]);
    }
    function AccountingPage() {
        const orders = props.orders || [];
        const payments = props.payments || [];
        const refunds = props.refunds || [];
        const financialRequests = props.financial_requests || [];
        const totalFees = orders.reduce((sum, order) => sum + Number(order.platform_fee || 0), 0);
        const pendingPayout = orders.filter(order => order.payment_status === "paid" && (order.payout_status || "pending") !== "transferred_to_partner").reduce((sum, order) => sum + Math.max(0, Number(order.total_price || 0) - Number(order.platform_fee || 0)), 0);
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u041a\u0430\u0431\u0438\u043d\u0435\u0442 \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0430"),
                h("div", { className: "react-actions" }, [
                    ButtonLink({ href: "/accounting/commissions.csv", className: "secondary" }, "\u041e\u0442\u0447\u0435\u0442 \u043f\u043e \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044f\u043c"),
                    ButtonLink({ href: "/logout", className: "secondary" }, "\u0412\u044b\u0439\u0442\u0438")
                ])
            ]),
            props.accounting_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.accounting_success),
            props.accounting_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.accounting_error),
            h("div", { className: "react-stat-grid" }, [
                h("div", { className: "react-card" }, [h("h2", null, payments.length), h("p", null, "\u041f\u043b\u0430\u0442\u0435\u0436\u0438")]),
                h("div", { className: "react-card" }, [h("h2", null, refunds.length), h("p", null, "\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b")]),
                h("div", { className: "react-card" }, [h("h2", null, money(pendingPayout)), h("p", null, "\u041d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u0438\u044f \u0444\u0435\u0440\u043c\u0435\u0440\u0430\u043c")]),
                h("div", { className: "react-card" }, [h("h2", null, money(totalFees)), h("p", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u0438")])
            ]),
            h("section", { className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [h("h2", null, "\u0424\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u0435 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f")]),
                financialRequests.length ? h("table", { className: "react-table" }, h("tbody", null, financialRequests.map(complaint => h("tr", { key: complaint.id }, [
                    h("td", null, `#${complaint.id}`),
                    h("td", null, complaint.order_id ? `#${complaint.order_id}` : "-"),
                    h("td", null, complaint.author ? (complaint.author.full_name || complaint.author.email) : "-"),
                    h("td", null, complaint.status || "-"),
                    h("td", null, h("div", { className: "react-actions" }, [
                        ButtonLink({ href: `/accounting/requests/${complaint.id}`, className: "secondary" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c")
                    ]))
                ])))) : h("div", { className: "react-empty" }, "\u0424\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u0445 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
            ]),
            h("section", { className: "react-panel" }, [
                h("h2", null, "\u0417\u0430\u043a\u0430\u0437\u044b \u0438 \u0432\u044b\u043f\u043b\u0430\u0442\u044b"),
                orders.length ? h("table", { className: "react-table" }, h("tbody", null, orders.map(order => h("tr", { key: order.id }, [
                    h("td", null, orderDisplayNumber(order)),
                    h("td", null, order.user ? order.user.email : "-"),
                    h("td", null, money(order.total_price)),
                    h("td", null, money(order.platform_fee)),
                    h("td", null, order.payout_status || "pending"),
                    h("td", null, h("div", { className: "react-actions" }, [
                        ButtonLink({ href: `/accounting/orders/${order.id}`, className: "secondary" }, "\u0414\u0435\u0442\u0430\u043b\u0438"),
                        (order.payout_status || "pending") !== "transferred_to_partner" && PostButton({ action: `/accounting/orders/${order.id}/payout`, children: "\u041f\u0435\u0440\u0435\u0434\u0430\u043d\u043e \u043f\u0430\u0440\u0442\u043d\u0435\u0440\u0443" }),
                        order.payment_status === "paid" && PostButton({ action: `/accounting/orders/${order.id}/refund`, children: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442", className: "react-btn danger", confirmMessage: "\u0418\u043d\u0438\u0446\u0438\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u043e\u0437\u0432\u0440\u0430\u0442?" })
                    ]))
                ])))) : h("div", { className: "react-empty" }, "\u0417\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
            ]),
            h(TransactionsTable, { transactions: props.transactions || [] })
        ]);
    }
    function AccountingOrderPage() {
        const order = props.order || {};
        const items = order.items || [];
        const subtotal = items.reduce((sum, item) => {
            const product = item.product || {};
            const base = productFinalPrice(product);
            return sum + base * Number(item.quantity || 0);
        }, 0);
        const deliveryFee = Number(order.delivery_fee || 0);
        const platformFee = Number(order.platform_fee || 0);
        const payoutAmount = Math.max(0, Number(order.total_price || 0) - platformFee);
        const sellerNames = [...new Set(items.map(item => item.product && item.product.owner ? ownerName(item.product) : null).filter(Boolean))];
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(order)}`),
                    h("p", { className: "react-muted" }, dateText(order.created_at))
                ]),
                h("div", { className: "react-actions" }, [
                    ButtonLink({ href: "/accounting/", className: "secondary" }, "\u041a \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u0438"),
                    ButtonLink({ href: "/logout", className: "secondary" }, "\u0412\u044b\u0439\u0442\u0438")
                ])
            ]),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u041a\u043b\u0438\u0435\u043d\u0442"), h("div", null, order.user ? (order.user.full_name || order.user.email || "-") : "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"), h("div", null, order.status || "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u041e\u043f\u043b\u0430\u0442\u0430"), h("div", null, paymentStatusText(order.payment_status))]),
                h("div", { className: "react-card" }, [h("b", null, "\u0412\u044b\u043f\u043b\u0430\u0442\u0430"), h("div", null, order.payout_status || "pending")])
            ]),
            h("section", { className: "react-panel" }, [
                h("h2", null, "\u0421РѕСЃС‚Р°РІ Р·Р°РєР°Р·Р°"),
                items.length ? h("table", { className: "react-table" }, h("tbody", null, items.map(item => {
                    const product = item.product || {};
                    return h("tr", { key: item.id }, [
                        h("td", null, product.name || "-"),
                        h("td", null, item.quantity || 0),
                        h("td", null, money(productFinalPrice(product))),
                        h("td", null, ownerName(product)),
                        h("td", null, money(productFinalPrice(product) * Number(item.quantity || 0)))
                    ]);
                }))) : h("div", { className: "react-empty" }, "\u041f\u043e\u0437\u0438\u0446\u0438\u0439 \u043d\u0435\u0442.")
            ]),
            h("section", { className: "react-panel" }, [
                h("h2", null, "\u0424\u0438\u043d\u0430\u043d\u0441\u044b"),
                h("div", { className: "react-info-grid" }, [
                    h("div", { className: "react-card" }, [h("b", null, "\u0421\u0443\u043c\u043c\u0430 \u0442\u043e\u0432\u0430\u0440\u043e\u0432"), h("div", null, money(subtotal))]),
                    h("div", { className: "react-card" }, [h("b", null, "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"), h("div", null, money(deliveryFee))]),
                    h("div", { className: "react-card" }, [h("b", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f"), h("div", null, money(platformFee))]),
                    h("div", { className: "react-card" }, [h("b", null, "\u041a \u0432\u044b\u043f\u043b\u0430\u0442\u0435"), h("div", null, money(payoutAmount))])
                ])
            ]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f"),
                h("div", { className: "react-chip-row" }, [
                    h("span", { className: "react-chip" }, `\u0424\u0435\u0440\u043c\u0435\u0440: ${sellerNames.length ? sellerNames.join(", ") : "-"}`),
                    h("span", { className: "react-chip" }, `\u0422\u043e\u0432\u0430\u0440\u043e\u0432: ${items.length}`),
                    h("span", { className: "react-chip" }, `\u041d\u043e\u043c\u0435\u0440: ${orderDisplayNumber(order)}`)
                ]),
                h("div", { className: "react-actions" }, [
                    (order.payout_status || "pending") !== "transferred_to_partner" && PostButton({ action: `/accounting/orders/${order.id}/payout`, children: "\u041f\u0435\u0440\u0435\u0434\u0430\u043d\u043e \u043f\u0430\u0440\u0442\u043d\u0435\u0440\u0443" }),
                    order.payment_status === "paid" && PostButton({ action: `/accounting/orders/${order.id}/refund`, children: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442", className: "react-btn danger", confirmMessage: "\u0418\u043d\u0438\u0446\u0438\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u043e\u0437\u0432\u0440\u0430\u0442?" })
                ])
            ])
        ]);
    }
    function ComplaintsPage() {
        const list = props.complaints || [];
        return h("section", { className: "react-panel" }, [
            h("h1", null, page === "complaints_admin" ? "\u0416\u0430\u043b\u043e\u0431\u044b" : "\u041c\u043e\u0438 \u0436\u0430\u043b\u043e\u0431\u044b"),
            props.complaint_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.complaint_success),
            props.complaint_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.complaint_error),
            list.length ? h("div", { className: "react-stack" }, list.map(item => {
                const c = item.complaint || item;
                return h("div", { key: c.id, className: "react-card" }, [
                    h("b", null, `${COMPLAINT_CATEGORY_LABELS[c.category] || c.category || c.type} \u00b7 ${c.status}`),
                    h("p", null, c.text),
                    c.attachment_path && ButtonLink({ href: c.attachment_path, className: "secondary" }, "\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u0435"),
                    c.admin_response && h("div", { className: "react-note" }, [
                        h("b", null, "\u041e\u0442\u0432\u0435\u0442 \u0430\u0434\u043c\u0438\u043d\u0430"),
                        h("p", null, c.admin_response)
                    ]),
                    h("p", { className: "react-muted" }, `#${c.id} \u00b7 ${dateText(c.created_at)}`),
                    h("div", { className: "react-actions" }, [
                        page === "complaints_admin" ? ButtonLink({ href: `/complaints/admin/${c.id}`, className: "secondary" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c") : ButtonLink({ href: `/complaints/my/${c.id}`, className: "secondary" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c")
                    ]),
                    page === "complaints_admin" && h("form", { action: `/complaints/status/${c.id}`, method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                        Select({ name: "status", defaultValue: c.status }, ["new", "in_progress", "waiting_farmer", "sent_to_accountant", "processing", "resolved", "rejected", "closed"].map(s => h("option", { value: s }, s))),
                        Textarea({ name: "response_text", placeholder: "\u041e\u0442\u0432\u0435\u0442 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430", defaultValue: c.admin_response || "", className: "wide", rows: 4, maxLength: 2000 }),
                        h("div", { className: "react-actions" }, [
                            h("button", { className: "react-btn", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"),
                            c.category === "payment" && PostButton({ action: `/complaints/admin/${c.id}/transfer`, children: "\u041f\u0435\u0440\u0435\u0434\u0430\u0442\u044c \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0443", className: "react-btn secondary" })
                        ])
                    ])
                ]);
            })) : h("div", { className: "react-empty" }, "\u0416\u0430\u043b\u043e\u0431 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    function ChatPage() {
        const order = props.order || {};
        const sellers = props.sellers || [];
        const messages = props.messages || [];
        const complaints = props.complaints || [];
        const categories = props.complaint_categories || {
            payment: "Оплата",
            delivery: "Доставка",
            quality: "Качество товара",
            order: "Заказ",
            seller: "Продавец",
            buyer: "Покупатель",
            other: "Другое"
        };
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, `\u0412\u043e\u043f\u0440\u043e\u0441 \u043f\u043e \u0437\u0430\u043a\u0430\u0437\u0443 ${orderDisplayNumber(order)}`),
                ButtonLink({ href: user && user.role === "seller" ? "/seller/orders" : "/order/orders", className: "secondary" }, "\u041d\u0430\u0437\u0430\u0434")
            ]),
            props.chat_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.chat_success),
            props.chat_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.chat_error),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u0427\u0430\u0442"),
                messages.length ? h("div", { className: "react-chat-list" }, messages.map(message => h("div", { key: message.id, className: `react-chat-message${message.sender_id === (user && user.id) ? " own" : ""}` }, [
                    h("b", null, message.author ? (message.author.farm_name || message.author.full_name || message.author.email) : "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a"),
                    h("p", null, message.message),
                    h("span", { className: "react-muted" }, dateText(message.created_at))
                ]))) : h("div", { className: "react-empty" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."),
                h("form", { action: `/chat/order/${order.id}/message`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    user && user.role !== "seller" && sellers.length > 1 ? Select({ name: "recipient_id" }, sellers.map(seller => h("option", { value: seller.id }, seller.farm_name || seller.full_name || seller.email))) : null,
                    Textarea({ name: "message", placeholder: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0444\u0435\u0440\u043c\u0435\u0440\u0443", className: "wide", rows: 4, required: true, maxLength: 2000 }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c")
                ])
            ]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0443"),
                h("form", { action: `/chat/order/${order.id}/complaint`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Select({ name: "category", defaultValue: "other" }, Object.keys(categories).map(key => h("option", { value: key }, categories[key]))),
                    sellers.length ? Select({ name: "target_user_id" }, sellers.map(seller => h("option", { value: seller.id }, seller.farm_name || seller.full_name || seller.email))) : null,
                    Textarea({ name: "text", placeholder: "\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044e", className: "wide", rows: 4, required: true, minLength: 10, maxLength: 2000 }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443")
                ]),
                complaints.length ? h("div", { className: "react-stack" }, complaints.map(c => h("div", { key: c.id, className: "react-card" }, [
                    h("b", null, `${c.type} \u00b7 ${c.status}`),
                    h("p", null, c.text)
                ]))) : null
            ])
        ]);
    }
    function ComplaintCreatePage() {
        const fallbackCategories = {
            payment: "Оплата",
            delivery: "Доставка",
            quality: "Качество товара",
            order: "Заказ",
            seller: "Продавец",
            buyer: "Покупатель",
            other: "Другое"
        };
        const rawCategories = props.complaint_categories;
        const categories = rawCategories && typeof rawCategories === "object" ? rawCategories : fallbackCategories;
        const categoryEntries = Object.entries(categories).filter(([, label]) => typeof label === "string" && label.trim());
        const safeCategoryEntries = categoryEntries.length ? categoryEntries : Object.entries(fallbackCategories);
        const hasOther = safeCategoryEntries.some(([key]) => key === "other");
        const initialCategory = hasOther ? "other" : (safeCategoryEntries[0] ? safeCategoryEntries[0][0] : "other");
        const [selectedCategory, setSelectedCategory] = React.useState(initialCategory);
        return h("section", { className: "react-panel", style: { maxWidth: 760, margin: "0 auto" } }, [
            h("h1", null, "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443"),
            props.complaint_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.complaint_success),
            props.complaint_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.complaint_error),
            h("form", { action: "/complaints/create", method: "post", encType: "multipart/form-data", className: "react-stack", onSubmit: handleSubmitOnce }, [
                h("div", { className: "react-stack" }, [
                    h("b", { key: "label" }, "Категория жалобы"),
                    h("div", { key: "chips", className: "react-chip-row react-complaint-category-chips" }, safeCategoryEntries.map(([key, label]) => h("button", {
                        key,
                        type: "button",
                        className: `react-chip react-chip-button${selectedCategory === key ? " active" : ""}`,
                        onClick: () => setSelectedCategory(key),
                        "aria-pressed": selectedCategory === key ? "true" : "false"
                    }, label))),
                    h("input", { key: "category-hidden", type: "hidden", name: "category", value: selectedCategory || "other" })
                ]),
                props.order && h("input", { type: "hidden", name: "order_id", value: props.order.id }),
                props.product && h("input", { type: "hidden", name: "target_product_id", value: props.product.id }),
                props.product && props.product.owner_id && h("input", { type: "hidden", name: "target_user_id", value: props.product.owner_id }),
                h("input", { name: "attachment", type: "file", className: "react-input wide", accept: "image/*,.pdf" }),
                Textarea({ name: "text", placeholder: "\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044e", required: true, minLength: 10, maxLength: 2000 }),
                h("button", { className: "react-btn", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435")
            ])
        ]);
    }
    function ReviewsAdminPage() {
        const list = props.reviews || [];
        return h("section", { className: "react-panel" }, [
            h("h1", null, "\u041e\u0442\u0437\u044b\u0432\u044b \u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438"),
            list.length ? h("div", { className: "react-stack" }, list.map(item => {
                const review = item.review || item;
                if (!review || !review.id) return null;
                return h("div", { key: review.id, className: "react-card" }, [
                    h("b", null, item.product_name || "\u0422\u043e\u0432\u0430\u0440"),
                    h("p", null, review.text || "\u0411\u0435\u0437 \u0442\u0435\u043a\u0441\u0442\u0430"),
                    h("div", { className: "react-actions" }, [
                        PostButton({ action: `/reviews/admin/${review.id}/approve`, children: "\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c" }),
                        PostButton({ action: `/reviews/admin/${review.id}/reject`, children: "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c \u043e\u0442\u0437\u044b\u0432?" })
                    ])
                ]);
            })) : h("div", { className: "react-empty" }, "\u041d\u0435\u0442 \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438.")
        ]);
    }
    function ConversationsListPage2() {
        const conversations = props.conversations || [];
        const [kindFilter, setKindFilter] = React.useState(props.kind || "all");
        const [statusFilter, setStatusFilter] = React.useState("all");
        const filtered = conversations.filter(item => {
            const conv = item.conversation || item;
            return (kindFilter === "all" || (conv.type || "") === kindFilter) && (statusFilter === "all" || (conv.status || "open") === statusFilter);
        });
        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u0414\u0438\u0430\u043b\u043e\u0433\u0438"),
                user && user.role === "seller" ? ButtonLink({ href: "/seller/support", className: "secondary" }, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430") : null
            ]),
            h("div", { className: "react-tab-row" }, [
                h("button", { type: "button", className: `react-btn ${kindFilter === "all" ? "" : "secondary"}`, onClick: () => setKindFilter("all") }, "\u0412\u0441\u0435"),
                h("button", { type: "button", className: `react-btn ${kindFilter === "order_chat" ? "" : "secondary"}`, onClick: () => setKindFilter("order_chat") }, "\u0417\u0430\u043a\u0430\u0437\u044b"),
                h("button", { type: "button", className: `react-btn ${kindFilter === "product_question" ? "" : "secondary"}`, onClick: () => setKindFilter("product_question") }, "\u0422\u043e\u0432\u0430\u0440\u044b"),
                h("button", { type: "button", className: `react-btn ${kindFilter === "complaint" ? "" : "secondary"}`, onClick: () => setKindFilter("complaint") }, "\u0416\u0430\u043b\u043e\u0431\u044b"),
                h("button", { type: "button", className: `react-btn ${kindFilter === "support_request" ? "" : "secondary"}`, onClick: () => setKindFilter("support_request") }, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430"),
                h("button", { type: "button", className: `react-btn ${kindFilter === "finance_request" ? "" : "secondary"}`, onClick: () => setKindFilter("finance_request") }, "\u0424\u0438\u043d\u0430\u043d\u0441\u044b")
            ]),
            h("div", { className: "react-tab-row" }, [
                h("button", { type: "button", className: `react-btn ${statusFilter === "all" ? "" : "secondary"}`, onClick: () => setStatusFilter("all") }, "\u0412\u0441\u0435"),
                h("button", { type: "button", className: `react-btn ${statusFilter === "open" ? "" : "secondary"}`, onClick: () => setStatusFilter("open") }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044b\u0435"),
                h("button", { type: "button", className: `react-btn ${statusFilter === "closed" ? "" : "secondary"}`, onClick: () => setStatusFilter("closed") }, "\u0417\u0430\u043a\u0440\u044b\u0442\u044b\u0435")
            ]),
            filtered.length ? h("div", { className: "react-stack" }, filtered.map(item => {
                const conv = item.conversation || item;
                const label = {
                    order_chat: "\u0417\u0430\u043a\u0430\u0437",
                    product_question: "\u0422\u043e\u0432\u0430\u0440",
                    complaint: "\u0416\u0430\u043b\u043e\u0431\u0430",
                    support_request: "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430",
                    finance_request: "\u0424\u0438\u043d\u0430\u043d\u0441\u044b"
                }[conv.type] || conv.type || "\u0414\u0438\u0430\u043b\u043e\u0433";
                return h("div", { key: conv.id, className: "react-card" }, [
                    h("b", null, `${label} #${conv.id}`),
                    h("p", null, item.order_number ? `\u0417\u0430\u043a\u0430\u0437 ${item.order_number}` : item.product_name ? item.product_name : item.complaint_id ? `\u041e\u0431\u0440. #${item.complaint_id}` : ""),
                    h("p", { className: "react-muted" }, item.last_message ? item.last_message.text : "\u0411\u0435\u0437 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439"),
                    h("div", { className: "react-actions" }, [ButtonLink({ href: `/conversations/${conv.id}`, className: "secondary" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c")])
                ]);
            })) : h("div", { className: "react-empty" }, "\u0411\u0435\u0437 \u0434\u0438\u0430\u043b\u043e\u0433\u043e\u0432.")
        ]);
    }
    function ConversationDetailPage2() {
        const conversation = props.conversation || {};
        const messages = props.messages || [];
        const label = {
            order_chat: "\u0417\u0430\u043a\u0430\u0437",
            product_question: "\u0422\u043e\u0432\u0430\u0440",
            complaint: "\u0416\u0430\u043b\u043e\u0431\u0430",
            support_request: "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430",
            finance_request: "\u0424\u0438\u043d\u0430\u043d\u0441\u044b"
        }[conversation.type] || conversation.type || "\u0414\u0438\u0430\u043b\u043e\u0433";
        const title = conversation.order ? `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(conversation.order)}` : conversation.product ? conversation.product.name : `#${conversation.id || ""}`;
        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [h("h1", null, title), h("p", { className: "react-muted" }, label)]),
                ButtonLink({ href: "/conversations/", className: "secondary" }, "\u041a \u0434\u0438\u0430\u043b\u043e\u0433\u0430\u043c")
            ]),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438"), h("p", null, [conversation.buyer ? (conversation.buyer.full_name || conversation.buyer.email) : "-", " / ", conversation.farmer ? (conversation.farmer.farm_name || conversation.farmer.full_name || conversation.farmer.email) : "-"])]),
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"), h("p", null, conversation.status || "-")]),
                conversation.product && h("div", { className: "react-card" }, [h("b", null, "\u0422\u043e\u0432\u0430\u0440"), h("p", null, conversation.product.name)]),
                conversation.complaint && h("div", { className: "react-card" }, [h("b", null, "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435"), h("p", null, COMPLAINT_CATEGORY_LABELS[conversation.complaint.category] || conversation.complaint.category || "-")])
            ]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f"),
                messages.length ? h("div", { className: "react-chat-list" }, messages.map(message => h("div", { key: message.id, className: `react-chat-message${message.sender_id === (user && user.id) ? " own" : ""}` }, [
                    h("b", null, `${message.sender ? (message.sender.full_name || message.sender.farm_name || message.sender.email) : "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a"} \u00b7 ${message.sender_role || ""}`),
                    h("p", null, message.text),
                    h("span", { className: "react-muted" }, dateText(message.created_at))
                ]))) : h("div", { className: "react-empty" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."),
                props.can_reply && h("form", { action: `/conversations/${conversation.id}/message`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Textarea({ name: "text", placeholder: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435", className: "wide", rows: 4, required: true, maxLength: 2000 }),
                    h("input", { name: "attachment", type: "file", className: "react-input wide" }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c")
                ])
            ])
        ]);
    }
    function ComplaintDetailPage2() {
        const complaint = props.complaint || {};
        const order = props.order || {};
        const conversation = props.conversation || {};
        const messages = props.messages || [];
        const recipientLabel = complaint.assigned_to_role === "accountant" ? "бухгалтерия" : "поддержка";
        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, `\u0416\u0430\u043b\u043e\u0431\u0430 #${complaint.id || ""}`),
                    h("p", { className: "react-muted" }, COMPLAINT_CATEGORY_LABELS[complaint.category] || complaint.category || complaint.type || "-")
                ]),
                user && user.role === "admin"
                    ? ButtonLink({ href: "/complaints/admin", className: "secondary" }, "\u041a \u0441\u043f\u0438\u0441\u043a\u0443")
                    : ButtonLink({ href: "/complaints/my", className: "secondary" }, "\u041a \u043c\u043e\u0438\u043c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f\u043c")
            ]),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"), h("p", null, complaint.status || "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0410\u0434\u0440\u0435\u0441\u0430\u0442"), h("p", null, recipientLabel)]),
                complaint.order_id && h("div", { className: "react-card" }, [h("b", null, "\u0417\u0430\u043a\u0430\u0437"), h("p", null, orderDisplayNumber(order) || `#${complaint.order_id}`)]),
                complaint.target_user_id && h("div", { className: "react-card" }, [h("b", null, "\u0424\u0435\u0440\u043c\u0435\u0440"), h("p", null, `${complaint.target_user_id}`)])
            ]),
            h("div", { className: "react-panel" }, h("p", null, complaint.text || complaint.description || "")),
            complaint.attachment_path && h("div", { className: "react-panel" }, [
                h("b", null, "\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u0435"),
                A({ href: complaint.attachment_path, target: "_blank" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0444\u0430\u0439\u043b")
            ]),
            complaint.admin_response && h("div", { className: "react-panel" }, [h("b", null, "\u041e\u0442\u0432\u0435\u0442"), h("p", null, complaint.admin_response)]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f"),
                messages.length ? h("div", { className: "react-chat-list" }, messages.map(message => h("div", { key: message.id, className: "react-chat-message" }, [
                    h("b", null, `${message.sender ? (message.sender.full_name || message.sender.farm_name || message.sender.email) : "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a"} \u00b7 ${message.sender_role || ""}`),
                    h("p", null, message.text),
                    h("span", { className: "react-muted" }, dateText(message.created_at))
                ]))) : h("div", { className: "react-empty" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."),
                h("div", { className: "react-actions" }, [
                    props.can_reply && h("form", { action: `/conversations/${conversation.id}/message`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                        Textarea({ name: "text", placeholder: "\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c", className: "wide", rows: 4, required: true, maxLength: 2000 }),
                        h("button", { className: "react-btn wide", type: "submit" }, "\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c")
                    ]),
                    props.can_transfer && PostButton({ action: `/complaints/admin/${complaint.id}/transfer`, children: "\u041f\u0435\u0440\u0435\u0434\u0430\u0442\u044c \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0443", className: "react-btn secondary" }),
                    props.can_status && h("form", { action: `/complaints/status/${complaint.id}`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                        Select({ name: "status", defaultValue: complaint.status }, ["new", "processing", "in_progress", "waiting_farmer", "sent_to_accountant", "resolved", "rejected", "closed"].map(status => h("option", { value: status }, status))),
                        Textarea({ name: "response_text", placeholder: "\u0421\u043b\u0443\u0436\u0435\u0431\u043d\u044b\u0439 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439", className: "wide", rows: 3, defaultValue: complaint.admin_response || "" }),
                        h("button", { className: "react-btn wide", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c")
                    ])
                ])
            ])
        ]);
    }
    function SellerSupportPage2() {
        const tickets = props.tickets || [];
        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430"),
                ButtonLink({ href: "/seller/", className: "secondary" }, "\u041a \u043a\u0430\u0431\u0438\u043d\u0435\u0442\u0443")
            ]),
            h("form", { action: "/seller/support/create", method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                Select({ name: "topic", defaultValue: "other" }, [
                    h("option", { value: "moderation" }, "\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f \u043f\u0440\u043e\u0444\u0438\u043b\u044f/\u0442\u043e\u0432\u0430\u0440\u0430"),
                    h("option", { value: "documents" }, "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430"),
                    h("option", { value: "certificates" }, "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u044b"),
                    h("option", { value: "block" }, "\u0411\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u043a\u0430"),
                    h("option", { value: "commission" }, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b"),
                    h("option", { value: "other" }, "\u0414\u0440\u0443\u0433\u043e\u0435")
                ]),
                Textarea({ name: "text", placeholder: "\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435", className: "wide", rows: 4, required: true, minLength: 10, maxLength: 2000 }),
                h("button", { className: "react-btn wide", type: "submit" }, "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435")
            ]),
            tickets.length ? h("div", { className: "react-stack" }, tickets.map(item => {
                const ticket = item.ticket || item;
                const conversationHref = item.conversation_id ? `/conversations/${item.conversation_id}` : "/seller/support";
                return h("div", { key: ticket.id, className: "react-card" }, [
                    h("b", null, `#${ticket.id}`),
                    h("p", null, COMPLAINT_CATEGORY_LABELS[ticket.category] || ticket.category || ticket.type),
                    h("p", null, ticket.text),
                h("div", { className: "react-actions" }, [
                        ButtonLink({ href: conversationHref, className: "secondary" }, item.conversation_id ? "\u041e\u0442\u043a\u0440\u044b\u0442\u044c" : "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c")
                ])
                ]);
            })) : h("div", { className: "react-empty" }, "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    function AccountingRequestPage2() {
        const complaint = props.complaint || {};
        const order = props.order || {};
        const messages = props.messages || [];
        return h("section", { className: "react-panel react-stack" }, [
            props.accounting_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.accounting_success),
            props.accounting_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.accounting_error),
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, `\u0424\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u043e\u0435 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435 #${complaint.id || ""}`),
                    h("p", { className: "react-muted" }, COMPLAINT_CATEGORY_LABELS[complaint.category] || complaint.category || "")
                ]),
                ButtonLink({ href: "/accounting/", className: "secondary" }, "\u041a \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u0438")
            ]),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"), h("p", null, complaint.status || "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0417\u0430\u043a\u0430\u0437"), h("p", null, orderDisplayNumber(order) || complaint.order_id || "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u0443\u043c\u043c\u0430"), h("p", null, money(order.total_price || 0))]),
                h("div", { className: "react-card" }, [h("b", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f"), h("p", null, money(order.platform_fee || 0))])
            ]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f"),
                messages.length ? h("div", { className: "react-chat-list" }, messages.map(message => h("div", { key: message.id, className: "react-chat-message" }, [
                    h("b", null, `${message.sender ? (message.sender.full_name || message.sender.farm_name || message.sender.email) : "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a"} \u00b7 ${message.sender_role || ""}`),
                    h("p", null, message.text),
                    h("span", { className: "react-muted" }, dateText(message.created_at))
                ]))) : h("div", { className: "react-empty" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."),
                h("form", { action: `/accounting/requests/${complaint.id}/comment`, method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Textarea({ name: "text", placeholder: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439", className: "wide", rows: 3, maxLength: 2000 }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439")
                ]),
                h("div", { className: "react-actions" }, [
                    order.id ? PostButton({ action: `/accounting/orders/${order.id}/payout`, children: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0432\u044b\u043f\u043b\u0430\u0442\u0443" }) : null,
                    order.id ? PostButton({ action: `/accounting/orders/${order.id}/refund`, children: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442", className: "react-btn danger", confirmMessage: "\u0418\u043d\u0438\u0446\u0438\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u043e\u0437\u0432\u0440\u0430\u0442?" }) : null
                ])
            ])
        ]);
    }
    function DeliveryTrackPage() {
        const delivery = props.delivery || {};
        const order = props.order || {};
        const steps = [
            { id: "accepted", label: "Принята логистикой" },
            { id: "in_transit", label: "В пути" },
            { id: "delivered", label: "Доставлена" }
        ];
        const stepOrder = { created: 0, accepted: 1, in_transit: 2, delivered: 3, manual: 1 };
        const status = delivery.status || "created";
        const statusRank = stepOrder[status] || 0;

        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, "Отслеживание доставки"),
                    h("p", { className: "react-muted" }, `Заказ ${orderDisplayNumber(order)}`)
                ]),
                ButtonLink({ href: user && user.role === "seller" ? "/seller/orders" : "/order/orders", className: "secondary" }, "К заказам")
            ]),
            h("div", { className: "react-info-grid react-logistics-grid" }, [
                h("div", { className: "react-card react-logistics-card" }, [h("b", null, "Логистическая компания"), h("p", null, delivery.provider || "Служба доставки")]),
                h("div", { className: "react-card react-logistics-card" }, [h("b", null, "Трек-номер"), h("p", { className: "react-track-number" }, delivery.track_number || "-")]),
                h("div", { className: "react-card react-logistics-card" }, [h("b", null, "Статус"), h("p", { className: "react-logistics-status" }, logisticsStatusText(status))]),
                h("div", { className: "react-card react-logistics-card" }, [h("b", null, "Адрес"), h("p", null, delivery.address || order.delivery_address || "-")])
            ]),
            h("div", { className: "react-panel react-logistics-timeline" }, [
                h("h2", null, "Маршрут"),
                h("div", { className: "react-delivery-timeline" }, steps.map((step, idx) => {
                    const rank = idx + 1;
                    const stateClass = rank < statusRank ? "is-done" : rank === statusRank ? "is-current" : "is-future";
                    return h("div", { key: step.id, className: `react-delivery-step ${stateClass}` }, [
                        h("span", { className: "react-delivery-step-dot" }),
                        h("span", { className: "react-delivery-step-label" }, step.label)
                    ]);
                }))
            ])
        ]);
    }
    function StaticPage() {
        const content = {
            about: ["\u041e \u043d\u0430\u0441", "\u041c\u044b \u0441\u043e\u0431\u0438\u0440\u0430\u0435\u043c \u0444\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0438\u0435 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u044b \u043d\u0430 \u043e\u0434\u043d\u043e\u0439 \u043f\u043b\u043e\u0449\u0430\u0434\u043a\u0435: \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044f\u043c \u043f\u0440\u043e\u0449\u0435 \u0432\u044b\u0431\u0438\u0440\u0430\u0442\u044c, \u0430 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430\u043c \u043f\u0440\u043e\u0449\u0435 \u043d\u0430\u0445\u043e\u0434\u0438\u0442\u044c \u0441\u0432\u043e\u0438\u0445 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432.", "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b: 8-906-440-29-35"],
            delivery: ["\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430", "\u041a\u0443\u0440\u044c\u0435\u0440, \u0441\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437 \u0438 \u043f\u043e\u0447\u0442\u043e\u0432\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430. \u0414\u0430\u0442\u0430 \u0438 \u0441\u043f\u043e\u0441\u043e\u0431 \u0443\u0442\u043e\u0447\u043d\u044f\u044e\u0442\u0441\u044f \u043f\u0440\u0438 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0438 \u0437\u0430\u043a\u0430\u0437\u0430."],
            business: ["\u0414\u043b\u044f \u0431\u0438\u0437\u043d\u0435\u0441\u0430", "\u041f\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u0444\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0438\u0445 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432 \u0434\u043b\u044f \u043a\u0430\u0444\u0435, \u043e\u0444\u0438\u0441\u043e\u0432 \u0438 \u043d\u0435\u0431\u043e\u043b\u044c\u0448\u0438\u0445 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u043e\u0432.", "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c"],
            reviews: ["\u041e\u0442\u0437\u044b\u0432\u044b", "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0438 \u043c\u043e\u0433\u0443\u0442 \u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043e\u0442\u0437\u044b\u0432 \u043f\u043e\u0441\u043b\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043d\u043e\u0433\u043e \u0437\u0430\u043a\u0430\u0437\u0430. \u041e\u0442\u0437\u044b\u0432\u044b \u043f\u0440\u043e\u0445\u043e\u0434\u044f\u0442 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044e."],
            recipes: ["\u0420\u0435\u0446\u0435\u043f\u0442\u044b", "\u0418\u0434\u0435\u0438 \u0434\u043b\u044f \u0441\u0435\u0437\u043e\u043d\u043d\u044b\u0445 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432: \u0437\u0430\u043f\u0435\u0447\u0435\u043d\u043d\u044b\u0435 \u043e\u0432\u043e\u0449\u0438, \u044f\u0433\u043e\u0434\u043d\u044b\u0435 \u0437\u0430\u0432\u0442\u0440\u0430\u043a\u0438, \u0434\u043e\u043c\u0430\u0448\u043d\u0438\u0435 \u0437\u0430\u0433\u043e\u0442\u043e\u0432\u043a\u0438 \u0438 \u0444\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0438\u0435 \u0441\u044b\u0440\u044b."],
            quality: ["\u0413\u0430\u0440\u0430\u043d\u0442\u0438\u044f \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430", "\u041c\u044b \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u044b, \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432 \u0438 \u0441\u0442\u0430\u0442\u0443\u0441 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430."],
            blog: ["\u0411\u043b\u043e\u0433", "\u041d\u043e\u0432\u043e\u0441\u0442\u0438 \u0444\u0435\u0440\u043c\u0435\u0440\u043e\u0432, \u0441\u0435\u0437\u043e\u043d\u043d\u044b\u0435 \u043f\u043e\u0434\u0431\u043e\u0440\u043a\u0438 \u0438 \u0437\u0430\u043c\u0435\u0442\u043a\u0438 \u043e \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u0430\u0445."],
            bonus: ["\u0411\u043e\u043d\u0443\u0441\u043d\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430", "\u0421\u043a\u0438\u0434\u043a\u0438 \u0438 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u044b \u0434\u043b\u044f \u043f\u043e\u0441\u0442\u043e\u044f\u043d\u043d\u044b\u0445 \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0435\u0439."],
            seller_pending: ["\u0417\u0430\u044f\u0432\u043a\u0430 \u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438", "\u0410\u0434\u043c\u0438\u043d \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u0442 \u0430\u043d\u043a\u0435\u0442\u0443 \u0444\u0435\u0440\u043c\u0435\u0440\u0430. \u041f\u043e\u0441\u043b\u0435 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u044f \u0432\u044b \u0441\u043c\u043e\u0436\u0435\u0442\u0435 \u0432\u0445\u043e\u0434\u0438\u0442\u044c \u0447\u0435\u0440\u0435\u0437 \u043e\u0431\u044b\u0447\u043d\u043e\u0435 \u043e\u043a\u043d\u043e \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438 \u0438 \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0431\u0438\u043d\u0435\u0442 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430."],
            verify_email_sent: ["\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 email", "\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u043d\u0438\u0436\u0435."],
            verify_email_result: [props.success ? "Email \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d" : "\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f", props.message || ""]
        }[page] || ["\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430", "\u0420\u0430\u0437\u0434\u0435\u043b \u043f\u0435\u0440\u0435\u0432\u0435\u0434\u0435\u043d \u043d\u0430 React."];
        return h("section", { className: "react-panel" }, [h("h1", null, content[0]), content.slice(1).map((p, i) => h("p", { key: i }, p)), props.verification_link && ButtonLink({ href: props.verification_link }, "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c email"), h("div", { style: { marginTop: 18 } }, ButtonLink({ href: "/", className: "secondary" }, "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e"))]);
    }
    function GenericPage() {
        return h("section", { className: "react-panel" }, [h("h1", null, "\u0420\u0430\u0437\u0434\u0435\u043b"), h("p", null, "\u0418\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u044d\u0442\u043e\u0439 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0447\u0435\u0440\u0435\u0437 \u043e\u0431\u0449\u0438\u0439 React-\u043a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442."), h("pre", { style: { whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto" } }, JSON.stringify(props, null, 2))]);
    }
    const pageMap = {
        index: HomePage,
        catalog: CatalogPage,
        search: CatalogPage,
        favorites: CatalogPage,
        product: ProductPage,
        login: LoginPage,
        register: RegisterPage,
        become_seller: BecomeSellerPage,
        cart: CartPage,
        seller: SellerPage,
        seller_settings: SellerPage,
        seller_settings: SellerPage,
        seller_orders: SellerOrdersPage,
        seller_product_edit: SellerEditPage,
        order: OrdersPage,
        profile: ProfilePage,
        order_chat: ChatPage,
        conversations: ConversationsListPage2,
        conversation: ConversationDetailPage2,
        wallet: WalletPage,
        transactions: TransactionsPage,
        seller_profile: SellerProfilePage,
        seller_pending: SellerPendingPage,
        payment: PaymentPage,
        payment_demo: PaymentDemoPage,
        order_receipt: ReceiptPage,
        notifications: NotificationsPage,
        notifications_admin: NotificationsPage,
        communications_admin: AdminHomePage,
        admin: AdminManagePage,
        manager: ModerationPage,
        analytics: AnalyticsPage,
        accounting: AccountingPage,
        accounting_order: AccountingOrderPage,
        accounting_request: AccountingRequestPage2,
        complaints_my: ComplaintsPage,
        complaints_admin: ComplaintsPage,
        complaint_detail: ComplaintDetailPage2,
        complaint_create: ComplaintCreatePage,
        reviews_admin: ReviewsAdminPage,
        product_reviews: () => h(ReviewsBlock, { reviews: props.reviews || [] }),
        seller_support: SellerSupportPage2,
        delivery_track: DeliveryTrackPage,
        about: StaticPage,
        delivery: StaticPage,
        business: StaticPage,
        reviews: StaticPage,
        recipes: StaticPage,
        quality: StaticPage,
        blog: StaticPage,
        bonus: StaticPage,
        verify_email_sent: StaticPage,
        verify_email_result: StaticPage
    };
    class ErrorBoundary extends React.Component {
        constructor(props) {
            super(props);
            this.state = { hasError: false };
        }
        static getDerivedStateFromError() {
            return { hasError: true };
        }
        componentDidCatch(error) {
            console.error(error);
        }
        render() {
            if (this.state.hasError) {
                return h("div", { className: "react-shell" }, [
                    h(Header, { key: "h" }),
                    h("main", { key: "m", className: "react-main react-page wrap" }, h("section", { className: "react-panel" }, [
                        h("h1", null, "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443"),
                        h("p", null, "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443. \u0415\u0441\u043b\u0438 \u0432\u044b \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u043b\u0438 \u043a\u043e\u0440\u0437\u0438\u043d\u0443 \u2014 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0435\u0451 \u0438\u043b\u0438 \u0432\u043e\u0439\u0442\u0438 \u0441\u043d\u043e\u0432\u0430."),
                        ButtonLink({ href: "/", className: "secondary" }, "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e"),
                        page === "cart" ? ButtonLink({ href: "/catalog" }, "\u0412 \u043a\u0430\u0442\u0430\u043b\u043e\u0433") : null
                    ])),
                    h(Footer, { key: "f" })
                ]);
            }
            return this.props.children;
        }
    }
    function App() {
        const Page = pageMap[page] || GenericPage;
        const [logoutConfirm, setLogoutConfirm] = React.useState(null);
        const [sellerSignupOpen, setSellerSignupOpen] = React.useState(page === "become_seller");
        const [noticeMessage, setNoticeMessage] = React.useState(props.notice_message || "");
        const onLogoutRequest = React.useCallback(event => {
            if (event) event.preventDefault();
            setLogoutConfirm({ href: "/logout" });
        }, []);
        const onBecomeSellerRequest = React.useCallback(event => {
            if (event) event.preventDefault();
            setSellerSignupOpen(true);
        }, []);
        const closeLogoutConfirm = React.useCallback(() => {
            setLogoutConfirm(null);
        }, []);
        const closeSellerSignup = React.useCallback(() => {
            setSellerSignupOpen(false);
        }, []);
        const closeNotice = React.useCallback(() => {
            setNoticeMessage("");
        }, []);
        const confirmLogout = React.useCallback(() => {
            const href = logoutConfirm && logoutConfirm.href ? logoutConfirm.href : "/logout";
            setLogoutConfirm(null);
            window.location.assign(href);
        }, [logoutConfirm]);
        return h(Shell, {
            onLogoutRequest,
            onBecomeSellerRequest,
            logoutConfirm,
            closeLogoutConfirm,
            confirmLogout,
            sellerSignupOpen,
            closeSellerSignup,
            noticeMessage,
            closeNotice
        }, h(Page, { onBecomeSellerRequest }));
    }
    function hydrateFavoriteButtons() {
        const forms = document.querySelectorAll("[data-favorite-form='true']");
        if (!forms.length || !window.fetch) return;
        fetch("/favorites/check", { credentials: "same-origin" })
            .then(response => response.ok ? response.json() : [])
            .then(ids => {
                const favoriteIds = new Set((ids || []).map(Number));
                forms.forEach(form => {
                    const productId = Number(form.dataset.productId);
                    const active = favoriteIds.has(productId);
                    form.action = `${active ? "/favorites/remove/" : "/favorites/add/"}${productId}`;
                    form.dataset.favoriteActive = active ? "true" : "false";
                    const button = form.querySelector("button");
                    if (button) {
                        button.classList.toggle("active", active);
                    }
                });
            })
            .catch(() => {});
    }
    ReactDOM.createRoot(document.getElementById("react-root")).render(h(ErrorBoundary, null, h(App)));
    window.setTimeout(() => {
        refreshIcons();
        hydrateFavoriteButtons();
    }, 0);
})();

