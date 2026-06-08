(function () {
    const h = React.createElement;
    const CDEK_PROVIDER = "\u0421\u0414\u042d\u041a";
    const CDEK_LEGACY_PROVIDER = "\u0421\u0414\u042d\u041a (\u0442\u0435\u0441\u0442)";
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
    const BULK_PRODUCT_CATEGORIES = ["Овощи", "Фрукты", "Ягоды", "Зелень"];
    const PRODUCT_UNITS = ["кг", "шт"];
    function isBulkProductCategory(category) {
        return BULK_PRODUCT_CATEGORIES.includes((category || "").trim());
    }
    function unitsForProductCategory(category) {
        return isBulkProductCategory(category) ? ["кг"] : ["шт"];
    }
    function normalizeProductUnit(unit, category) {
        return isBulkProductCategory(category) ? "кг" : "шт";
    }
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
    function dateTimeText(value) {
        if (!value) return "";
        try {
            return new Date(value).toLocaleString("ru-RU");
        } catch (_) {
            return value;
        }
    }
    function formatFileSize(bytes) {
        const value = Number(bytes || 0);
        if (!value) return "0 Б";
        const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
        let index = 0;
        let size = value;
        while (size >= 1024 && index < units.length - 1) {
            size /= 1024;
            index += 1;
        }
        return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
    }
    function orderDisplayNumber(order) {
        if (!order) return "";
        return order.order_number || `#${order.id || ""}`;
    }
    function sellerPickupAddress(seller) {
        if (!seller) return "";
        return String(seller.pickup_address || seller.farm_address || "").trim();
    }
    function orderPickupAddress(order) {
        if (!order || (order.delivery_method || "") !== "pickup") return "";
        return String(order.delivery_address || (order.delivery && order.delivery.address) || "").trim();
    }
    function PickupAddressBlock({ address, comment, className }) {
        if (!address && !comment) return null;
        return h("div", { className: `react-pickup-address ${className || ""}`.trim() }, [
            address ? h("p", null, [h("b", null, "\u0410\u0434\u0440\u0435\u0441 \u0441\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437\u0430: "), address]) : null,
            comment ? h("p", { className: "react-muted" }, comment) : null
        ]);
    }
    function deliveryMethodText(value) {
        return {
            courier: "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430 \u0444\u0435\u0440\u043c\u0435\u0440\u043e\u043c",
            farmer_delivery: "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430 \u0444\u0435\u0440\u043c\u0435\u0440\u043e\u043c",
            pickup: "\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437",
            post: CDEK_PROVIDER,
            partner_delivery: CDEK_PROVIDER,
            market: "\u0412\u044b\u0434\u0430\u0447\u0430 \u043d\u0430 \u0440\u044b\u043d\u043a\u0435"
        }[value] || value || "";
    }
    function isCdekTestDelivery(method, provider, trackNumber) {
        const value = String(method || "").trim();
        const providerText = String(provider || "").trim();
        const trackText = String(trackNumber || "").trim();
        return value === "partner_delivery" || value === "post" || providerText === CDEK_PROVIDER || providerText === CDEK_LEGACY_PROVIDER || /^CDEK/i.test(trackText);
    }
    function CdekDeliveryBadge({ method, provider, trackNumber }) {
        if (!isCdekTestDelivery(method, provider, trackNumber)) return null;
        return h("span", { className: "react-cdek-delivery-badge" }, CDEK_PROVIDER);
    }
    function deliveryPriceValue(value) {
        if (value && typeof value === "object") {
            return Number(value.delivery_fee || value.delivery_price || value.delivery && value.delivery.delivery_fee || 0);
        }
        return ({ farmer_delivery: 500, courier: 500, pickup: 0, partner_delivery: 700, post: 700, market: 0 })[value] || 0;
    }
    function paymentStatusText(value) {
        return ({ pending: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b", paid: "\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e", failed: "\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u043f\u043b\u0430\u0442\u044b", cancelled: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043e", canceled: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043e", refunded: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442" })[value] || value || "-";
    }
    function orderStatusText(order, labels) {
        if (order && ["created", "awaiting_payment"].includes(order.status || "") && order.payment_status === "pending") {
            return "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b";
        }
        return (labels && order && labels[order.status]) || (order && order.status) || "-";
    }
    function deliveryStatusText(order) {
        const status = order && order.delivery && order.delivery.status || order && order.delivery_status || order && order.status;
        return ({
            created: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b",
            waiting_payment: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b",
            waiting_assembly: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u0441\u0431\u043e\u0440\u043a\u0438",
            paid: "\u041e\u043f\u043b\u0430\u0447\u0435\u043d, \u0436\u0434\u0435\u0442 \u0441\u0431\u043e\u0440\u043a\u0438",
            confirmed: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d",
            assembling: "\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f",
            ready_for_pickup: "\u0413\u043e\u0442\u043e\u0432\u0430 \u043a \u0441\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437\u0443",
            ready_for_delivery: "\u0413\u043e\u0442\u043e\u0432\u0430 \u043a \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435",
            transferred_to_delivery: "\u041f\u0435\u0440\u0435\u0434\u0430\u043d\u0430 \u0432 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443",
            shipped: "\u041f\u0435\u0440\u0435\u0434\u0430\u043d\u0430 \u0432 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443",
            in_transit: "\u0412 \u043f\u0443\u0442\u0438",
            delivering: "\u0412 \u043f\u0443\u0442\u0438",
            delivered: "\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u0430",
            completed: "\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u0430",
            canceled: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d",
            cancelled: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u0430",
            refunded: "\u0412\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d"
        })[status] || status || "-";
    }
    function isOrderPayable(order) {
        return order && ["created", "awaiting_payment", "payment_failed"].includes(order.status || "created") && (order.payment_status || "pending") === "pending";
    }
    function isOrderCancelled(order) {
        if (!order) return false;
        return ["cancelled", "canceled", "refunded"].includes(order.status || "");
    }
    function orderRefundNote(order) {
        if (!order || !isOrderCancelled(order)) return "";
        if (order.payment_status === "refunded") return "\u041e\u043f\u043b\u0430\u0442\u0430 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d\u0430 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443.";
        if (order.payment_status === "paid") {
            return "\u0412\u043e\u0437\u0432\u0440\u0430\u0442 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443 \u0431\u0443\u0434\u0435\u0442 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d \u043f\u043e\u0441\u043b\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f \u042eKassa.";
        }
        return "";
    }
    function OrderCancelStatusBlock({ order, statusLabels }) {
        if (!isOrderCancelled(order)) return null;
        const status = order.status || "";
        const label = (statusLabels && statusLabels[status]) || orderStatusText(order, statusLabels);
        const reason = order.return_reason || order.seller_cancel_reason;
        const refundNote = orderRefundNote(order);
        return h("div", { className: "react-order-cancel-banner", role: "status" }, [
            h("strong", null, label),
            reason ? h("p", null, reason) : null,
            refundNote ? h("p", { className: "react-muted" }, refundNote) : null
        ]);
    }
    function isOrderCancellable(order) {
        if (!order) return false;
        const status = order.status || "";
        if (["cancelled", "canceled", "refunded", "completed", "received"].includes(status)) return false;
        if (isOrderPayable(order)) return true;
        return ["paid", "confirmed"].includes(status);
    }
    function isAdminOrderCancellable(order) {
        if (!order) return false;
        const status = order.status || "";
        if (["cancelled", "canceled", "refunded", "completed", "received"].includes(status)) return false;
        return ["created", "awaiting_payment", "payment_failed", "paid", "confirmed", "assembling", "ready_for_pickup", "ready_for_delivery", "in_delivery"].includes(status);
    }
    function isOrderItemExcludable(order, role) {
        if (!order) return false;
        const status = order.status || "";
        if (["cancelled", "canceled", "refunded", "completed", "received", "delivered"].includes(status)) return false;
        const sellerStatuses = ["created", "awaiting_payment", "payment_failed", "paid", "confirmed", "assembling", "ready_for_pickup", "ready_for_delivery"];
        const adminStatuses = sellerStatuses.concat(["in_delivery"]);
        const allowed = role === "admin" ? adminStatuses : sellerStatuses;
        return allowed.includes(status) && (order.items || []).length > 1;
    }
    function isOrderReceivable(order) {
        return order && ["ready_for_pickup", "delivered"].includes(order.status || "");
    }
    function logisticsStatusText(value) {
        return ({
            created: "Создана",
            waiting_payment: "Ожидает оплаты",
            waiting_assembly: "Ожидает сборки",
            ready_for_pickup: "Готова к самовывозу",
            ready_for_delivery: "Готова к доставке",
            transferred_to_delivery: "Передана в доставку",
            accepted: "Принята перевозчиком",
            in_transit: "В пути",
            delivered: "Доставлена",
            cancelled: "Отменена",
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
            pending: "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435",
            approved: "\u041e\u0434\u043e\u0431\u0440\u0435\u043d\u0430",
            rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0430",
            new: "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435",
            in_progress: "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435",
            waiting_documents: "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435",
        }[value] || value || "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435";
    }
    function farmerApplicationNumber(seller) {
        const number = seller && seller.seller_application_number;
        if (number) {
            return String(number);
        }
        if (seller && seller.id) {
            const idPart = String(seller.id).padStart(5, "0");
            return `ZF-${idPart}`;
        }
        return "\u2014";
    }
    function productStatusText(value) {
        return {
            approved: "\u041e\u0434\u043e\u0431\u0440\u0435\u043d",
            pending: "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435",
            rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d"
        }[value] || value || "\u041e\u0434\u043e\u0431\u0440\u0435\u043d";
    }
    const COMPLAINT_STATUS_OPTIONS = ["new", "in_progress", "resolved", "rejected"];
    function complaintStatusText(value) {
        return {
            new: "\u041d\u043e\u0432\u0430\u044f",
            processing: "\u0412 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0435",
            in_progress: "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435",
            waiting_farmer: "\u0416\u0434\u0435\u043c \u0444\u0435\u0440\u043c\u0435\u0440\u0430",
            sent_to_accountant: "\u041f\u0435\u0440\u0435\u0434\u0430\u043d\u0430 \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0443",
            resolved: "\u0420\u0435\u0448\u0435\u043d\u0430",
            rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0430",
            closed: "\u0417\u0430\u043a\u0440\u044b\u0442\u0430"
        }[value] || value || "-";
    }
    function roleText(value) {
        return {
            user: "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c",
            seller: "\u0424\u0435\u0440\u043c\u0435\u0440",
            manager: "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440",
            admin: "\u0410\u0434\u043c\u0438\u043d",
            accountant: "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440"
        }[value] || value || "-";
    }
    const PRODUCT_QUESTION_STATUS_OPTIONS = ["open", "resolved"];
    function conversationStatusText(value) {
        return ({
            open: "\u041e\u0442\u043a\u0440\u044b\u0442",
            closed: "\u0417\u0430\u043a\u0440\u044b\u0442",
            resolved: "\u0420\u0435\u0448\u0451\u043d"
        })[value] || value || "-";
    }
    function productQuestionStatusText(value, labels) {
        const map = labels || {
            open: "\u041e\u0442\u043a\u0440\u044b\u0442",
            resolved: "\u0420\u0435\u0448\u0451\u043d"
        };
        return map[value] || conversationStatusText(value);
    }
    function normalizeProductQuestionStatus(value) {
        const status = String(value || "open").toLowerCase();
        if (status === "closed" || status === "done" || status === "completed") {
            return "resolved";
        }
        return PRODUCT_QUESTION_STATUS_OPTIONS.includes(status) ? status : "open";
    }
    function payoutStatusText(value) {
        return {
            pending: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u0432\u044b\u043f\u043b\u0430\u0442\u044b",
            transferred_to_partner: "\u0412\u044b\u043f\u043b\u0430\u0447\u0435\u043d\u043e \u0444\u0435\u0440\u043c\u0435\u0440\u0443",
            refunded: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442"
        }[value] || value || "-";
    }
    function transactionStatusText(value) {
        return {
            pending: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442",
            completed: "\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0430",
            failed: "\u041e\u0448\u0438\u0431\u043a\u0430",
            canceled: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u0430",
            refunded: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442"
        }[value] || value || "-";
    }
    function transactionTypeText(value) {
        return {
            deposit: "\u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435",
            withdrawal: "\u0412\u044b\u0432\u043e\u0434",
            payment: "\u041e\u043f\u043b\u0430\u0442\u0430",
            refund: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442",
            payout: "\u041d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u0438\u0435",
            escrow_hold: "\u0423\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435",
            escrow_release: "\u0412\u044b\u043f\u0443\u0441\u043a",
            withdrawal_request: "\u0417\u0430\u044f\u0432\u043a\u0430 \u043d\u0430 \u0432\u044b\u0432\u043e\u0434",
            withdrawal_paid: "\u0412\u044b\u0432\u043e\u0434 \u0432\u044b\u043f\u043b\u0430\u0447\u0435\u043d",
            withdrawal_rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0438\u0435 \u0432\u044b\u0432\u043e\u0434\u0430"
        }[value] || value || "-";
    }
    function ledgerEntryTypeText(entry) {
        if (!entry) return "-";
        return transactionTypeText(entry.entry_type);
    }
    function OrderSettlementBlock({ settlement }) {
        if (!settlement || settlement.goods_total == null) return null;
        return h("div", { className: "react-panel react-stack", style: { marginTop: 12 } }, [
            h("h3", null, "\u0420\u0430\u0441\u0447\u0451\u0442 \u043f\u043e \u0437\u0430\u043a\u0430\u0437\u0443"),
            h("p", null, `\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u0442\u043e\u0432\u0430\u0440\u043e\u0432: ${money(settlement.goods_total)}`),
            h("p", { className: "react-muted" }, `\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b (${settlement.commission_percent}%): ${money(settlement.commission_amount)}`),
            h("p", { className: "react-price" }, `\u0412\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u0435: ${money(settlement.seller_net)}`),
            settlement.escrow_status === "pending"
                ? h("p", { className: "react-muted" }, "\u0421\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0443\u0434\u0435\u0440\u0436\u0430\u043d\u044b \u0434\u043e \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u044f.")
                : h("p", { className: "react-muted" }, "\u0421\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0437\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u044b \u043d\u0430 \u0431\u0430\u043b\u0430\u043d\u0441.")
        ]);
    }
    function statusChipTone(value) {
        const normalized = String(value || "").toLowerCase();
        if (["approved", "paid", "completed", "received", "resolved", "transferred_to_partner", "delivered"].includes(normalized)) return "success";
        if (["pending", "new", "created", "awaiting_payment", "confirmed", "processing", "in_progress", "waiting_documents", "waiting_farmer", "sent_to_accountant", "assembling", "ready_for_pickup", "ready_for_delivery", "waiting_payment", "waiting_assembly", "transferred_to_delivery", "in_transit", "shipped", "delivering", "open"].includes(normalized)) return "warning";
        if (["rejected", "canceled", "cancelled", "refunded", "closed", "failed", "payment_failed"].includes(normalized)) return "danger";
        return "neutral";
    }
    function StatusChip({ value, label }) {
        return h("span", { className: `react-chip react-chip-${statusChipTone(value)}` }, label || value || "-");
    }
    function ownerName(product) {
        const owner = product && product.owner;
        if (!owner) return "\u0424\u0435\u0440\u043c\u0435\u0440";
        return owner.farm_name || owner.full_name || "\u0424\u0435\u0440\u043c\u0435\u0440";
    }
    function conversationParticipantName(person, roleHint) {
        if (!person) return "\u2014";
        const role = roleHint || person.role || "";
        if (role === "seller") {
            return String(person.farm_name || person.full_name || "").trim() || "\u0424\u0435\u0440\u043c\u0435\u0440";
        }
        return String(person.full_name || "").trim() || "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c";
    }
    function messageSenderName(sender) {
        if (!sender) return "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a";
        if (sender.role === "seller") {
            return String(sender.farm_name || sender.full_name || "").trim() || "\u0424\u0435\u0440\u043c\u0435\u0440";
        }
        return String(sender.full_name || "").trim() || roleText(sender.role) || "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c";
    }
    function stockQuantity(product) {
        if (!product) return 0;
        const raw = product.stock_quantity !== undefined && product.stock_quantity !== null ? product.stock_quantity : product.stock;
        const value = Number(raw || 0);
        return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    }
    function stockUnit(product) {
        return normalizeProductUnit(product && product.unit, product && product.category);
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
        vegetables: "/static/product-images/vegetables-herbs.jpg",
        fruit: "/static/product-images/fruits-berries.jpg",
        eggs: "/static/product-images/dairy-eggs.jpg",
        honey: "/static/product-images/basket-hits.jpg",
        bread: "/static/product-images/bread-vegetables.jpg",
        dairy: "/static/product-images/dairy-eggs.jpg",
        cheese: "/static/product-images/dairy-eggs.jpg",
        meat: "/static/product-images/basket-hits.jpg"
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
    function productGalleryUrls(product) {
        const urls = ((product && product.image_urls) || []).filter(Boolean);
        if (urls.length) {
            return urls;
        }
        const primary = product && product.image_url;
        const fallback = fallbackProductImage(product);
        const merged = [];
        if (primary) {
            merged.push(primary);
        }
        if (fallback && fallback !== primary) {
            merged.push(fallback);
        }
        return merged;
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
    function ProductGallery({ product }) {
        const urls = productGalleryUrls(product);
        const [index, setIndex] = React.useState(0);
        const [broken, setBroken] = React.useState({});
        const touchStartX = React.useRef(null);
        React.useEffect(() => {
            setIndex(0);
            setBroken({});
        }, [product && product.id]);
        if (!urls.length) {
            return h(ProductPlaceholder, { product });
        }
        const count = urls.length;
        const hasMany = count > 1;
        const safeIndex = Math.min(index, count - 1);
        const go = delta => setIndex(current => (current + delta + count) % count);
        const onTouchStart = event => {
            const touch = event.touches && event.touches[0];
            touchStartX.current = touch ? touch.clientX : null;
        };
        const onTouchEnd = event => {
            if (!hasMany || touchStartX.current === null) {
                return;
            }
            const touch = event.changedTouches && event.changedTouches[0];
            if (!touch) {
                return;
            }
            const delta = touch.clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) < 40) {
                return;
            }
            go(delta < 0 ? 1 : -1);
        };
        return h("div", {
            className: `react-product-gallery${hasMany ? " has-many" : ""}`,
            onTouchStart,
            onTouchEnd
        }, [
            h("div", {
                key: "viewport",
                className: "react-product-gallery-viewport",
                "aria-roledescription": "carousel",
                "aria-label": (product && product.name) || "\u0424\u043e\u0442\u043e \u0442\u043e\u0432\u0430\u0440\u0430"
            }, [
                h("div", {
                    key: "track",
                    className: "react-product-gallery-track",
                    style: { transform: `translateX(-${safeIndex * 100}%)` }
                }, urls.map((url, slideIndex) => h("div", { key: `${url}-${slideIndex}`, className: "react-product-gallery-slide" }, broken[slideIndex]
                    ? h(ProductPlaceholder, { product })
                    : h("img", {
                        src: url,
                        alt: `${(product && product.name) || "\u0422\u043e\u0432\u0430\u0440"} \u2014 \u0444\u043e\u0442\u043e ${slideIndex + 1}`,
                        loading: slideIndex === 0 ? "eager" : "lazy",
                        onError: () => setBroken(prev => ({ ...prev, [slideIndex]: true }))
                    })))),
                hasMany && h("button", {
                    key: "prev",
                    type: "button",
                    className: "react-product-gallery-nav prev",
                    "aria-label": "\u041f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0435\u0435 \u0444\u043e\u0442\u043e",
                    onClick: () => go(-1)
                }, "\u2039"),
                hasMany && h("button", {
                    key: "next",
                    type: "button",
                    className: "react-product-gallery-nav next",
                    "aria-label": "\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0435 \u0444\u043e\u0442\u043e",
                    onClick: () => go(1)
                }, "\u203a")
            ]),
            hasMany && h("div", { key: "dots", className: "react-product-gallery-dots", role: "tablist" }, urls.map((url, dotIndex) => h("button", {
                key: url,
                type: "button",
                role: "tab",
                className: `react-product-gallery-dot${dotIndex === safeIndex ? " active" : ""}`,
                "aria-label": `\u0424\u043e\u0442\u043e ${dotIndex + 1}`,
                "aria-selected": dotIndex === safeIndex ? "true" : "false",
                onClick: () => setIndex(dotIndex)
            }))),
            hasMany && h("div", { key: "counter", className: "react-product-gallery-counter" }, `${safeIndex + 1} / ${count}`)
        ]);
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
        if (form.querySelector("[data-ru-phone]")) {
            validateFormRuPhones(form);
        }
        if (form.checkValidity && !form.checkValidity()) {
            event.preventDefault();
            form.reportValidity();
            return false;
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
    function omitEmptyGetFields(event) {
        const form = event.currentTarget;
        if (!form || String(form.method || "").toLowerCase() !== "get") return true;
        form.querySelectorAll("input, select, textarea").forEach(control => {
            if (!control.name || control.disabled) return;
            if (String(control.value || "").trim() === "") {
                control.disabled = true;
            }
        });
        return true;
    }
    function requiresInlineAuth(action) {
        return !user && typeof action === "string" && (
            action.startsWith("/cart/add/") ||
            action.startsWith("/favorites/add/") ||
            action.startsWith("/favorites/remove/")
        );
    }
    function requestInlineAuth(event) {
        if (event) event.preventDefault();
        window.dispatchEvent(new CustomEvent("react:auth-required", { detail: { view: "login" } }));
        return false;
    }
    function PostButton({ action, children, className, title, ariaLabel, icon, confirmMessage, formClassName, formProps }) {
        const submitHandler = event => {
            if (requiresInlineAuth(action)) {
                return requestInlineAuth(event);
            }
            return confirmMessage ? confirmSubmit(confirmMessage)(event) : handleSubmitOnce(event);
        };
        return h(
            "form",
            {
                action,
                method: "post",
                className: `react-inline-form ${formClassName || ""}`,
                onSubmit: submitHandler,
                ...(formProps || {})
            },
            h(
                "button",
                { type: "submit", className: className || "react-btn", title, "aria-label": ariaLabel || title },
                icon ? Icon({ name: icon }) : children
            )
        );
    }
    function CancelOrderButton({ action, children, confirmText }) {
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
            }, h("button", { type: "submit", className: "react-btn danger" }, children || "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437")),
            h(ConfirmDialog, {
                key: "cancel-dialog",
                open,
                title: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437",
                text: confirmText || "\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u0437\u0430\u043a\u0430\u0437?",
                onCancel: () => setOpen(false),
                onConfirm: submitCancel,
                cancelLabel: "\u041e\u0441\u0442\u0430\u0442\u044c\u0441\u044f",
                confirmLabel: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437",
                confirmClassName: "react-btn danger",
                titleId: "cancel-order-confirm-title"
            })
        ]);
    }
    function OrderCancelForm({
        action,
        confirmText,
        hint,
        reasonRequired,
        reasonPlaceholder,
        buttonLabel,
        className,
        hiddenFields,
        style
    }) {
        const [open, setOpen] = React.useState(false);
        const [error, setError] = React.useState("");
        const formRef = React.useRef(null);
        const openDialog = event => {
            event.preventDefault();
            setError("");
            setOpen(true);
        };
        const closeDialog = () => {
            setOpen(false);
            setError("");
        };
        const submitCancel = () => {
            const form = formRef.current;
            if (!form) return;
            if (reasonRequired) {
                const textarea = form.querySelector('textarea[name="cancel_reason"]');
                const value = (textarea && textarea.value || "").trim();
                if (value.length < 5) {
                    setError("\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043f\u0440\u0438\u0447\u0438\u043d\u0443 \u043e\u0442\u043c\u0435\u043d\u044b (\u043d\u0435 \u043a\u043e\u0440\u043e\u0447\u0435 5 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432).");
                    if (textarea) textarea.focus();
                    return;
                }
            }
            form.dataset.submitted = "true";
            form.submit();
        };
        return h(React.Fragment, null, [
            h("form", {
                key: "cancel-form",
                ref: formRef,
                action,
                method: "post",
                className: className || "react-stack",
                style,
                onSubmit: openDialog
            }, [
                hint ? h("p", { className: "react-muted" }, hint) : null,
                ...(hiddenFields || []),
                Textarea({
                    name: "cancel_reason",
                    placeholder: reasonPlaceholder || "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043c\u0435\u043d\u044b",
                    rows: 2,
                    maxLength: 2000,
                    required: reasonRequired,
                    minLength: reasonRequired ? 5 : undefined
                }),
                h("button", { type: "submit", className: "react-btn danger" }, buttonLabel || "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437")
            ]),
            h(ConfirmDialog, {
                key: "cancel-dialog",
                open,
                title: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437",
                text: confirmText || "\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u0437\u0430\u043a\u0430\u0437?",
                error,
                onCancel: closeDialog,
                onConfirm: submitCancel,
                cancelLabel: "\u041e\u0441\u0442\u0430\u0442\u044c\u0441\u044f",
                confirmLabel: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437",
                confirmClassName: "react-btn danger",
                titleId: "cancel-order-confirm-title"
            })
        ]);
    }
    function UserOrderCancelForm({ order }) {
        if (!isOrderCancellable(order)) return null;
        if (isOrderPayable(order)) {
            return h(CancelOrderButton, {
                action: `/order/${order.id}/cancel`,
                children: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c",
                confirmText: "\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u0437\u0430\u043a\u0430\u0437?"
            });
        }
        return h(OrderCancelForm, {
            action: `/order/${order.id}/cancel`,
            className: "react-panel react-stack",
            confirmText: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0439 \u0437\u0430\u043a\u0430\u0437? \u0414\u0435\u043d\u044c\u0433\u0438 \u0432\u0435\u0440\u043d\u0443\u0442\u0441\u044f \u043d\u0430 \u043a\u0430\u0440\u0442\u0443.",
            hint: "\u041e\u0442\u043c\u0435\u043d\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0434\u043e \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u0431\u043e\u0440\u043a\u0438. \u041e\u043f\u043b\u0430\u0442\u0430 \u0431\u0443\u0434\u0435\u0442 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d\u0430 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443.",
            reasonPlaceholder: "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043c\u0435\u043d\u044b (\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e)"
        });
    }
    function AdminOrderCancelForm({ order }) {
        if (!isAdminOrderCancellable(order)) return null;
        return h(OrderCancelForm, {
            action: `/admin/order/cancel/${order.id}`,
            className: "react-stack",
            style: { minWidth: 220 },
            confirmText: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437? \u0414\u043b\u044f \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432 \u0434\u0435\u043d\u044c\u0433\u0438 \u0432\u0435\u0440\u043d\u0443\u0442\u0441\u044f \u043d\u0430 \u043a\u0430\u0440\u0442\u0443 \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044e.",
            reasonPlaceholder: "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043c\u0435\u043d\u044b"
        });
    }
    function OrderItemExcludeForm({ action, productName, paid }) {
        const [open, setOpen] = React.useState(false);
        const [error, setError] = React.useState("");
        const [reason, setReason] = React.useState("");
        const formRef = React.useRef(null);
        const openDialog = () => {
            setError("");
            setReason("");
            setOpen(true);
        };
        const closeDialog = () => {
            setOpen(false);
            setError("");
        };
        const submitExclude = () => {
            const value = (reason || "").trim();
            if (value.length < 5) {
                setError("\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043f\u0440\u0438\u0447\u0438\u043d\u0443 \u0438\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f (\u043d\u0435 \u043a\u043e\u0440\u043e\u0447\u0435 5 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432).");
                return;
            }
            const form = formRef.current;
            if (!form) return;
            const hidden = form.querySelector('textarea[name="exclusion_reason"]');
            if (hidden) hidden.value = value;
            form.dataset.submitted = "true";
            form.submit();
        };
        return h(React.Fragment, null, [
            h("form", { ref: formRef, action, method: "post", className: "react-order-item-exclude-form" }, [
                h("textarea", { name: "exclusion_reason", defaultValue: "", style: { display: "none" } }),
                h("button", { type: "button", className: "react-btn secondary", onClick: openDialog }, "\u0418\u0441\u043a\u043b\u044e\u0447\u0438\u0442\u044c")
            ]),
            open && h("div", { className: "react-modal-overlay", onClick: closeDialog }, h("div", {
                className: "react-modal",
                role: "dialog",
                "aria-modal": "true",
                onClick: event => event.stopPropagation()
            }, [
                h("h3", { className: "react-modal-title" }, "\u0418\u0441\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440 \u0438\u0437 \u0437\u0430\u043a\u0430\u0437\u0430"),
                h("p", { className: "react-modal-text" }, productName ? `\u0422\u043e\u0432\u0430\u0440: ${productName}` : "\u0422\u043e\u0432\u0430\u0440 \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043b\u0451\u043d \u0438\u0437 \u0437\u0430\u043a\u0430\u0437\u0430."),
                paid ? h("p", { className: "react-muted" }, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c \u043f\u043e\u043b\u0443\u0447\u0438\u0442 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435 \u0441 \u0443\u043a\u0430\u0437\u0430\u043d\u0438\u0435\u043c \u043f\u0440\u0438\u0447\u0438\u043d\u044b.") : h("p", { className: "react-muted" }, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c \u043f\u043e\u043b\u0443\u0447\u0438\u0442 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435 \u0441 \u0443\u043a\u0430\u0437\u0430\u043d\u0438\u0435\u043c \u043f\u0440\u0438\u0447\u0438\u043d\u044b."),
                h("textarea", {
                    className: "react-input wide",
                    placeholder: "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u0438\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f",
                    rows: 3,
                    maxLength: 2000,
                    value: reason,
                    onChange: event => setReason(event.target.value)
                }),
                error ? h("p", { className: "react-modal-text", style: { color: "#8a1f17" } }, error) : null,
                h("div", { className: "react-modal-actions" }, [
                    h("button", { type: "button", className: "react-btn secondary", onClick: closeDialog }, "\u041e\u0442\u043c\u0435\u043d\u0430"),
                    h("button", { type: "button", className: "react-btn danger", onClick: submitExclude }, "\u0418\u0441\u043a\u043b\u044e\u0447\u0438\u0442\u044c")
                ])
            ]))
        ]);
    }
    function OrderItemExcludeAction({ order, item, role }) {
        if (!isOrderItemExcludable(order, role)) return null;
        const productName = item.product ? item.product.name : "\u0422\u043e\u0432\u0430\u0440";
        const paid = (order.payment_status || "pending") === "paid";
        const action = role === "admin"
            ? `/admin/order/${order.id}/items/${item.id}/exclude`
            : `/seller/orders/${order.id}/items/${item.id}/exclude`;
        return h(OrderItemExcludeForm, { action, productName, paid });
    }
    function ButtonLink({ href, children, className, key }, fallbackChildren) {
        return A({ key, href, className: `react-btn ${className || ""}` }, children || fallbackChildren);
    }
    function interactiveRowProps(href) {
        const open = event => {
            if (!href || event.target.closest("a, button, input, select, textarea, label, form")) return;
            window.location.href = href;
        };
        return {
            className: "react-clickable-row",
            tabIndex: 0,
            role: "link",
            "data-href": href,
            onClick: open,
            onKeyDown: event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                open(event);
            }
        };
    }
    function iconName(title) {
        const map = {
            "\u041a\u043e\u0440\u0437\u0438\u043d\u0430": "shopping-cart",
            "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435": "heart",
            "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f": "bell",
            "\u041a\u043e\u0448\u0435\u043b\u0435\u043a": "wallet",
            "\u041f\u0440\u043e\u0444\u0438\u043b\u044c": "user-round",
            "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f": "calculator",
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
            [
                Icon({ key: "icon", name: iconName(title) }),
                h("span", { key: "label", className: "react-icon-btn-label" }, title)
            ]
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
                h("span", { key: "label", className: "react-icon-btn-label" }, "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f"),
                count > 0 ? h("span", { key: "badge", className: "react-counter-badge" }, count > 99 ? "99+" : String(count)) : null
            ]
        );
    }
    function ruPhoneDigits(value) {
        let digits = String(value || "").replace(/\D/g, "");
        if (!digits) return "";
        if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
        if (!digits.startsWith("7")) digits = `7${digits}`;
        return digits.slice(0, 11);
    }
    function formatRuPhoneMask(value) {
        const digits = ruPhoneDigits(value);
        if (!digits) return "";
        const tail = digits.slice(1);
        let out = "+7";
        if (!tail.length) return out;
        out += ` (${tail.slice(0, 3)}`;
        if (tail.length < 3) return out;
        out += `) ${tail.slice(3, 6)}`;
        if (tail.length < 6) return out;
        out += `-${tail.slice(6, 8)}`;
        if (tail.length < 8) return out;
        return `${out}-${tail.slice(8, 10)}`;
    }
    function isRuPhoneComplete(value) {
        return ruPhoneDigits(value).length === 11;
    }
    const RU_PHONE_VALIDATION_MESSAGE = "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430 \u043f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e \u0432 \u0444\u043e\u0440\u043c\u0430\u0442\u0435 +7 (999) 999-99-99";
    function syncRuPhoneValidity(input) {
        if (!input) return true;
        const value = input.value || "";
        if (!value.trim() && !input.required) {
            input.setCustomValidity("");
            return true;
        }
        if (!isRuPhoneComplete(value)) {
            input.setCustomValidity(RU_PHONE_VALIDATION_MESSAGE);
            return false;
        }
        input.setCustomValidity("");
        return true;
    }
    function validateFormRuPhones(form) {
        let valid = true;
        form.querySelectorAll("[data-ru-phone]").forEach(input => {
            if (!syncRuPhoneValidity(input)) valid = false;
        });
        return valid;
    }
    function handleRuPhoneInput(event) {
        const input = event.currentTarget;
        const digits = ruPhoneDigits(input.value);
        const formatted = formatRuPhoneMask(digits);
        input.value = formatted;
        if (typeof input.setSelectionRange === "function") {
            input.setSelectionRange(formatted.length, formatted.length);
        }
        syncRuPhoneValidity(input);
    }
    function handleRuPhoneBlur(event) {
        syncRuPhoneValidity(event.currentTarget);
    }
    function handleRuPhoneFocus(event) {
        const input = event.currentTarget;
        if (!ruPhoneDigits(input.value)) {
            input.value = "+7 ";
        }
        syncRuPhoneValidity(input);
    }
    function Field({ name, type, placeholder, defaultValue, required, className, min, max, step, minLength, maxLength, pattern, title, onChange, autoComplete }) {
        if (type === "password") {
            return h(PasswordField, {
                name,
                placeholder,
                defaultValue,
                required,
                className,
                minLength,
                maxLength,
                autoComplete
            });
        }
        return h("input", { className: `react-input ${className || ""}`, name, type: type || "text", placeholder, defaultValue: defaultValue || "", required, min, max, step, minLength, maxLength, pattern, title, onChange, autoComplete });
    }
    function PasswordVisibilityIcon({ visible }) {
        const svgProps = {
            xmlns: "http://www.w3.org/2000/svg",
            width: 20,
            height: 20,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            className: "react-password-toggle-icon"
        };
        if (visible) {
            return h("svg", svgProps, [
                h("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" }),
                h("line", { x1: 1, y1: 1, x2: 23, y2: 23 })
            ]);
        }
        return h("svg", svgProps, [
            h("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
            h("circle", { cx: 12, cy: 12, r: 3 })
        ]);
    }
    function PasswordField({ name, placeholder, defaultValue, required, className, minLength, maxLength, autoComplete }) {
        const [visible, setVisible] = React.useState(false);
        const resolvedAutoComplete = autoComplete || (name === "password_confirm" ? "new-password" : name === "password" ? "current-password" : "off");
        function toggleVisibility(event) {
            event.preventDefault();
            setVisible(current => !current);
        }
        return h("div", {
            className: `react-password-field ${className || ""}`.trim()
        }, [
            h("input", {
                className: "react-input react-password-input",
                name,
                type: visible ? "text" : "password",
                placeholder,
                defaultValue: defaultValue || "",
                required,
                minLength,
                maxLength,
                autoComplete: resolvedAutoComplete
            }),
            h("button", {
                type: "button",
                className: "react-password-toggle",
                "aria-label": visible ? "\u0421\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c" : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c",
                "aria-pressed": visible,
                tabIndex: 0,
                onClick: toggleVisibility
            }, h(PasswordVisibilityIcon, { visible }))
        ]);
    }
    function PhoneField({ name, placeholder, defaultValue, required, className }) {
        return h("input", {
            className: `react-input ${className || ""}`,
            name,
            type: "tel",
            "data-ru-phone": "true",
            placeholder: placeholder || "+7 (___) ___-__-__",
            defaultValue: formatRuPhoneMask(defaultValue || ""),
            required,
            minLength: 18,
            maxLength: 18,
            pattern: "\\+7 \\(\\d{3}\\) \\d{3}-\\d{2}-\\d{2}",
            title: RU_PHONE_VALIDATION_MESSAGE,
            inputMode: "tel",
            autoComplete: "tel",
            onInput: handleRuPhoneInput,
            onBlur: handleRuPhoneBlur,
            onFocus: handleRuPhoneFocus
        });
    }
    function Select({ name, defaultValue, value, onChange, children, className, ariaLabel }, fallbackChildren) {
        const selectProps = { className: `react-select ${className || ""}`, name, "aria-label": ariaLabel || name };
        if (value !== undefined) {
            selectProps.value = value;
        } else {
            selectProps.defaultValue = defaultValue || "";
        }
        if (onChange) {
            selectProps.onChange = onChange;
        }
        return h("select", selectProps, children || fallbackChildren);
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
    function Header({ onLogoutRequest, onBecomeSellerRequest, onLoginRequest }) {
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
                    (!user || ["user", "seller"].includes(user.role)) && h(CartLink, { key: "cart", onLoginRequest }),
                    user && ["user", "seller"].includes(user.role) && IconLink({ key: "fav", href: "/favorites/", title: "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435" }),
                    user && user.role === "user" && IconLink({ key: "orders", href: "/order/orders", title: "\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b" }),
                    user && ["user", "seller"].includes(user.role) && IconLink({ key: "profile", href: user.role === "seller" ? "/seller/?tab=profile" : "/profile", title: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c" }),
                    user && ["user", "seller"].includes(user.role) && h(NotificationsLink, { key: "nt" }),
                    user && user.role === "seller" && IconLink({ key: "wl", href: "/seller/?tab=finance", title: "\u041c\u043e\u0439 \u0431\u0430\u043b\u0430\u043d\u0441" }),
                    user && ["admin"].includes(user.role) && IconLink({ key: "adm", href: "/admin/", title: "\u0410\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c" }),
                    user && ["accountant"].includes(user.role) && IconLink({ key: "acc", href: "/accounting/", title: "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f" }),
                    user && user.role === "seller" && IconLink({ key: "sell", href: "/seller/", title: "\u041a\u0430\u0431\u0438\u043d\u0435\u0442 \u0444\u0435\u0440\u043c\u0435\u0440\u0430" }),
                    user ? IconLink({ key: "out", href: "/logout", title: "\u0412\u044b\u0439\u0442\u0438", onClick: onLogoutRequest }) : IconLink({ key: "in", href: "/login", title: "\u0412\u043e\u0439\u0442\u0438", onClick: onLoginRequest })
                ])
            ),
            h("form", { action: "/search", method: "get", className: "react-search wrap" }, [
                A({
                    key: "catalog",
                    href: "/catalog",
                    className: "react-btn react-catalog-direct-link"
                }, "\u041a\u0430\u0442\u0430\u043b\u043e\u0433"),
                h(SearchBox, { key: "searchbox" }),
                h("button", { key: "submit", className: "react-btn", type: "submit" }, "\u041d\u0430\u0439\u0442\u0438")
            ])
        );
    }
    function CartLink({ onLoginRequest }) {
        const [count, setCount] = React.useState(Number(props.cart_position_count || 0));
        React.useEffect(() => {
            let alive = true;
            const update = event => {
                const detail = event.detail || {};
                setCount(Number(detail.position_count || 0));
            };
            window.addEventListener("react:cart-updated", update);
            if (user && user.role === "user" && window.fetch) {
                fetch("/cart/state", { credentials: "same-origin" })
                    .then(response => response.ok ? response.json() : { position_count: 0 })
                    .then(data => {
                        if (alive) setCount(Number((data && data.position_count) || 0));
                    })
                    .catch(() => {
                        if (alive) setCount(0);
                    });
            }
            return () => {
                alive = false;
                window.removeEventListener("react:cart-updated", update);
            };
        }, []);
        return A(
            { href: "/cart/", title: "\u041a\u043e\u0440\u0437\u0438\u043d\u0430", "aria-label": "\u041a\u043e\u0440\u0437\u0438\u043d\u0430", className: "react-icon-btn react-icon-btn-badge", onClick: !user ? onLoginRequest : undefined },
            [
                Icon({ key: "icon", name: iconName("\u041a\u043e\u0440\u0437\u0438\u043d\u0430") }),
                h("span", { key: "label", className: "react-icon-btn-label" }, "\u041a\u043e\u0440\u0437\u0438\u043d\u0430"),
                count > 0 ? h("span", { key: "badge", className: "react-counter-badge" }, count > 99 ? "99+" : String(count)) : null
            ]
        );
    }
    function Footer({ onBecomeSellerRequest }) {
        return h("footer", { className: "react-footer" },
            h("div", { className: "react-footer-inner wrap" }, [
                h("div", { key: "brand", className: "react-footer-brand" }, [
                    h("h4", null, "\u0421\u0432\u043e\u0438 \u0420\u044f\u0434\u044b"),
                    h("p", null, "Фермерские продукты от локальных продавцов: каталог, заказ, оплата, доставка и поддержка в одном месте.")
                ]),
                h("div", { key: "clients", className: "react-footer-links" }, [
                    h("h4", null, "Покупателям"),
                    A({ href: "/delivery" }, "Доставка и самовывоз"),
                    A({ href: "/quality" }, "Качество товаров"),
                    A({ href: "/bonus" }, "Бонусы и скидки"),
                    A({ href: "/reviews" }, "Отзывы")
                ]),
                h("div", { key: "company", className: "react-footer-links" }, [
                    h("h4", null, "Площадка"),
                    A({ href: "/about" }, "О нас"),
                    A({ href: "/become-seller", onClick: onBecomeSellerRequest }, "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c"),
                    A({ href: "/business" }, "Для бизнеса"),
                    A({ href: "/recipes" }, "Рецепты"),
                    A({ href: "/blog" }, "Блог")
                ]),
                h("div", { key: "phone", className: "react-footer-contact" }, [
                    h("h4", null, "8-906-440-29-35"),
                    h("p", null, "Ежедневно с 8:00 до 21:00"),
                    h("p", null, "Поможем с заказом, оплатой, доставкой и обращениями."),
                    A({ href: "/complaints/create", className: "react-footer-help" }, "Написать в поддержку")
                ])
            ])
        );
    }
    function AdminShell({ children, onLogoutRequest }) {
        const isManager = user && user.role === "manager";
        return h("div", { className: "react-shell" }, [
            h("div", { key: "top", className: "react-admin-top" },
                h("div", { className: "react-admin-head wrap" }, [
                    A({ key: "logo", href: isManager ? "/admin/moderation" : "/admin/", className: "react-logo" }, [h("strong", null, "\u0421\u0412\u041e\u0418 \u0420\u042f\u0414\u042b"), h("span", null, isManager ? "\u041f\u0430\u043d\u0435\u043b\u044c \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0430" : "\u041f\u0430\u043d\u0435\u043b\u044c \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f")]),
                    h("nav", { key: "nav", className: "react-admin-nav" }, [
                        !isManager && A({ href: "/admin/" }, "\u0413\u043b\u0430\u0432\u043d\u0430\u044f"),
                        A({ href: "/" }, "\u0412\u0438\u0442\u0440\u0438\u043d\u0430"),
                        A({ href: "/reviews/admin" }, "\u041e\u0442\u0437\u044b\u0432\u044b"),
                        A({ href: "/complaints/admin" }, "\u0416\u0430\u043b\u043e\u0431\u044b"),
                        !isManager && A({ href: "/notifications/admin" }, "\u0420\u0430\u0441\u0441\u044b\u043b\u043a\u0438"),
                        A({ href: "/admin/analytics/" }, "\u041e\u0442\u0447\u0435\u0442\u044b"),
                        A({ href: "/admin/moderation" }, "\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f"),
                        !isManager && A({ href: "/admin/manage" }, "\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435"),
                        !isManager && A({ href: "/admin/manage?tab=finance" }, "\u0424\u0438\u043d\u0430\u043d\u0441\u044b"),
                        !isManager && A({ href: "/admin/backups" }, "\u0420\u0435\u0437\u0435\u0440\u0432\u043d\u043e\u0435 \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435"),
                        A({ href: "/logout", onClick: onLogoutRequest }, "\u0412\u044b\u0439\u0442\u0438")
                    ].filter(Boolean))
                ])
            ),
            h("main", { key: "main", className: "react-main react-page wrap" }, children)
        ]);
    }
    function AccountantShell({ children, onLogoutRequest }) {
        return h("div", { className: "react-shell" }, [
            h("div", { key: "top", className: "react-admin-top" },
                h("div", { className: "react-admin-head wrap" }, [
                    A({ key: "logo", href: "/accounting/", className: "react-logo" }, [h("strong", null, "\u0421\u0412\u041e\u0418 \u0420\u042f\u0414\u042b"), h("span", null, "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0438\u044f")]),
                    h("nav", { key: "nav", className: "react-admin-nav" }, [
                        A({ href: "/accounting/" }, "\u0413\u043b\u0430\u0432\u043d\u0430\u044f"),
                        A({ href: "/" }, "\u0412\u0438\u0442\u0440\u0438\u043d\u0430"),
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
                        A({ href: "/seller/?tab=finance" }, "\u041c\u043e\u0439 \u0431\u0430\u043b\u0430\u043d\u0441"),
                        A({ href: "/seller/?tab=history" }, "\u0418\u0441\u0442\u043e\u0440\u0438\u044f"),
                        A({ href: "/" }, "\u0412\u0438\u0442\u0440\u0438\u043d\u0430"),
                        A({ href: "/conversations/?kind=order_chat" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f"),
                        A({ href: "/seller/support" }, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430"),
                        A({ href: "/logout", onClick: onLogoutRequest }, "\u0412\u044b\u0439\u0442\u0438")
                    ])
                ])
            ),
            h("main", { key: "main", className: "react-main react-page wrap" }, children)
        ]);
    }
    function ConfirmDialog({ open, title, text, error, onCancel, onConfirm, cancelLabel, confirmLabel, confirmClassName, titleId }) {
        const dialogTitleId = titleId || "react-confirm-dialog-title";
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
                "aria-labelledby": dialogTitleId,
                onClick: event => event.stopPropagation()
            }, [
                h("h3", { key: "title", id: dialogTitleId, className: "react-modal-title" }, title),
                text ? h("p", { key: "text", className: "react-modal-text" }, text) : null,
                error ? h("p", { key: "error", className: "react-modal-text", style: { color: "#8a1f17" } }, error) : null,
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
        const [submitting, setSubmitting] = React.useState(false);
        function handleSellerSubmit(event) {
            setSubmitting(true);
            return handleSubmitOnce(event);
        }
        return h("form", { action: "/become-seller", method: "post", className: compact ? "react-stack" : "react-form-grid", onSubmit: handleSellerSubmit }, [
            Field({ name: "email", type: "email", placeholder: "Email", defaultValue: props.email, required: true }),
            Field({ name: "password", type: "password", placeholder: "\u041f\u0430\u0440\u043e\u043b\u044c", required: true, minLength: 6 }),
            Field({ name: "full_name", placeholder: "\u0424\u0418\u041e / \u0438\u043c\u044f \u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044f", defaultValue: props.full_name, required: true, maxLength: 255 }),
            Field({ name: "farm_name", placeholder: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0445\u043e\u0437\u044f\u0439\u0441\u0442\u0432\u0430", defaultValue: props.farm_name, required: true, maxLength: 255 }),
            PhoneField({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: props.phone, required: true }),
            Field({ name: "farm_address", placeholder: "\u0420\u0435\u0433\u0438\u043e\u043d", defaultValue: props.farm_address, className: compact ? "" : "wide", required: true, maxLength: 500 }),
            Textarea({ name: "product_categories", placeholder: "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u0438", defaultValue: props.product_categories, className: compact ? "" : "wide", rows: compact ? 3 : 4, required: true, maxLength: 1000 }),
            Textarea({ name: "farm_description", placeholder: "\u041a\u0440\u0430\u0442\u043a\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0445\u043e\u0437\u044f\u0439\u0441\u0442\u0432\u0430", defaultValue: props.farm_description, className: compact ? "" : "wide", rows: compact ? 4 : 5, required: true, maxLength: 2000 }),
            props.error ? h("p", { className: compact ? "alert alert-danger" : "wide alert alert-danger" }, props.error) : null,
            h("button", { className: compact ? "react-btn" : "react-btn wide", type: "submit", disabled: submitting }, submitting ? "\u0418\u0434\u0435\u0442 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0430..." : "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443")
        ]);
    }
    function Shell({ children, onLogoutRequest, onBecomeSellerRequest, onLoginRequest, logoutConfirm, closeLogoutConfirm, confirmLogout, authView, closeAuth, switchAuth, noticeMessage, closeNotice }) {
        const activeAuthView = authView || (authRouteSet.has(page) ? page : null);
        if (authRouteSet.has(page)) {
            return h("div", { className: "react-shell react-auth-shell" }, [
                h("main", { key: "m", className: "react-main" }),
                h(AuthFlowModal, { key: "auth-modal", open: Boolean(activeAuthView), view: activeAuthView, onClose: closeAuth, onSwitch: switchAuth })
            ]);
        }
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
                h(AccountantShell, { key: "accountant", onLogoutRequest }, children),
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
        if (user && (user.role === "admin" || user.role === "manager")) {
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
                    text: "\u0412\u044b \u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441\u0435\u0441\u0441\u0438\u044e?",
                    onCancel: closeLogoutConfirm,
                    onConfirm: confirmLogout
                })
            ]);
        }
        return h("div", { className: "react-shell" }, [
            h(Header, { key: "h", onLogoutRequest, onBecomeSellerRequest, onLoginRequest }),
            h("main", { key: "m", className: "react-main react-page wrap" }, children),
            h(Footer, { key: "f", onBecomeSellerRequest }),
            h(ConfirmDialog, {
                key: "logout-dialog",
                open: Boolean(logoutConfirm),
                title: "\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430",
                text: "\u0412\u044b \u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441\u0435\u0441\u0441\u0438\u044e?",
                onCancel: closeLogoutConfirm,
                onConfirm: confirmLogout
            }),
            h(AuthFlowModal, { key: "auth-modal", open: Boolean(activeAuthView), view: activeAuthView, onClose: closeAuth, onSwitch: switchAuth }),
            h(NoticeDialog, {
                key: "notice-dialog",
                open: showGlobalNotice,
                title: "\u0417\u0430\u044f\u0432\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430",
                text: noticeMessage || "",
                onClose: closeNotice
            })
        ]);
    }
    function ProductCard({ product, favorite, cartQuantity, onCartQuantityChange }) {
        if (!product) return null;
        const status = stockStatus(product);
        const hasDiscount = Boolean(product.has_discount || (Number(product.discount_price || 0) > 0 && Number(product.discount_price || 0) < Number(product.price || 0)));
        const productRating = Number(product.product_rating || 0);
        const sellerRating = Number(product.seller_rating || 0);
        const productReviewCount = Number(product.product_review_count || 0);
        const sellerReviewCount = Number(product.seller_review_count || product.review_count || 0);
        return h("article", { className: `react-product-card stock-${status}` }, [
            A({ key: "img", href: `/product/${product.id}`, className: "react-product-image" },
                h(React.Fragment, null, [
                    hasDiscount ? h("span", { className: "react-product-badge" }, "\u0421\u043a\u0438\u0434\u043a\u0430") : null,
                    h(ProductMedia, { product })
                ])
            ),
            h("div", { key: "body", className: "react-product-body" }, [
                h("div", { key: "chips", className: "react-chip-row react-product-meta" }, [
                    product.category && h("span", { className: "react-chip" }, product.category),
                    productRating ? h("span", { className: "react-chip react-rating-chip" }, `\u2605 \u0422\u043e\u0432\u0430\u0440 ${productRating}${productReviewCount ? ` (${productReviewCount})` : ""}`) : null,
                    sellerRating ? h("span", { className: "react-chip react-rating-chip" }, `\u2605 \u0424\u0435\u0440\u043c\u0435\u0440 ${sellerRating}${sellerReviewCount ? ` (${sellerReviewCount})` : ""}`) : null
                ]),
                A({ key: "name", href: `/product/${product.id}`, className: "react-product-name" }, product.name),
                sellerLink(product)
                    ? A({ key: "seller", href: sellerLink(product), className: "react-muted react-product-seller-line" }, `\u043e\u0442 ${ownerName(product)}`)
                    : h("div", { key: "seller", className: "react-muted react-product-seller-line" }, `\u043e\u0442 ${ownerName(product)}`),
                h("div", { key: "price", className: "react-product-price-row" }, h(PriceDisplay, { product })),
                h("div", { key: "stock", className: `react-stock-label stock-${status}` }, stockText(product)),
                h("div", { key: "actions", className: "react-actions" }, [
                    h(ProductCartControl, { product, quantity: cartQuantity, onQuantityChange: onCartQuantityChange }),
                    FavoriteButton({ product, favorite })
                ])
            ])
        ]);
    }
    function renderStars(rating) {
        const value = Math.max(0, Math.min(5, Number(rating) || 0));
        return "\u2605".repeat(value) + "\u2606".repeat(5 - value);
    }
    function ReviewResponse({ response }) {
        const [open, setOpen] = React.useState(false);
        const text = (response || "").trim();
        if (!text) return null;
        return h("div", { className: "react-review-response" }, [
            h("button", {
                type: "button",
                className: "react-review-response-toggle",
                onClick: () => setOpen(value => !value),
                "aria-expanded": open ? "true" : "false"
            }, open ? "\u0421\u043a\u0440\u044b\u0442\u044c \u043e\u0442\u0432\u0435\u0442 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430" : "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u043e\u0442\u0432\u0435\u0442 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430"),
            open ? h("div", { className: "react-review-response-body" }, text) : null
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
    function notifyCartState(data) {
        window.dispatchEvent(new CustomEvent("react:cart-updated", { detail: data || { position_count: 0, items: {} } }));
    }
    function ProductCartControl({ product, quantity, onQuantityChange }) {
        const [busy, setBusy] = React.useState(false);
        const [message, setMessage] = React.useState("");
        const qty = Number(quantity || 0);
        const maxQty = stockQuantity(product);
        const requestCart = action => {
            if (!user) {
                window.dispatchEvent(new CustomEvent("react:auth-required", { detail: { view: "login" } }));
                return;
            }
            if (!product || busy) return;
            setBusy(true);
            setMessage("");
            fetch(action, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                }
            })
                .then(response => response.json().then(data => ({ ok: response.ok && data.ok !== false, data })))
                .then(result => {
                    const data = result.data || {};
                    const nextQty = Number((data.items && data.items[String(product.id)]) || 0);
                    if (onQuantityChange) onQuantityChange(product.id, nextQty);
                    notifyCartState(data);
                    setMessage(result.ok ? "" : (data.message || "Не удалось обновить корзину."));
                })
                .catch(() => setMessage("Не удалось обновить корзину."))
                .finally(() => setBusy(false));
        };
        if (!canBuy(product)) return h("span", { className: "react-stock-empty" }, "\u041d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438");
        if (qty <= 0) {
            return h("div", { className: "react-product-cart-control" }, [
                h("button", { type: "button", className: "react-btn react-buy-btn", disabled: busy, onClick: () => requestCart(`/cart/add/${product.id}`) }, busy ? "\u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u043c..." : "\u0412 \u043a\u043e\u0440\u0437\u0438\u043d\u0443"),
                message ? h("span", { className: "react-cart-inline-message" }, message) : null
            ]);
        }
        return h("div", { className: "react-product-cart-control" }, [
            h("div", { className: "react-product-qty-control" }, [
                h("button", { type: "button", className: "react-icon-btn react-qty-symbol-btn", disabled: busy, title: "\u0423\u043c\u0435\u043d\u044c\u0448\u0438\u0442\u044c", onClick: () => requestCart(`/cart/dec-product/${product.id}`) }, "\u2212"),
                h("span", { className: "react-cart-qty" }, qty),
                h("button", { type: "button", className: "react-icon-btn react-qty-symbol-btn", disabled: busy || qty >= maxQty, title: "\u0423\u0432\u0435\u043b\u0438\u0447\u0438\u0442\u044c", onClick: () => requestCart(`/cart/add/${product.id}`) }, "+")
            ]),
            message ? h("span", { className: "react-cart-inline-message" }, message) : null
        ]);
    }
    function ProductsGrid({ products, favorite }) {
        const list = products || [];
        const [cartItems, setCartItems] = React.useState({});
        React.useEffect(() => {
            let alive = true;
            if (user && user.role === "user" && window.fetch) {
                fetch("/cart/state", { credentials: "same-origin" })
                    .then(response => response.ok ? response.json() : { items: {}, position_count: 0 })
                    .then(data => {
                        if (!alive) return;
                        setCartItems(data.items || {});
                        notifyCartState(data);
                    })
                    .catch(() => {});
            }
            return () => {
                alive = false;
            };
        }, []);
        const setProductQuantity = (productId, quantity) => {
            setCartItems(current => {
                const next = { ...(current || {}) };
                if (quantity > 0) next[String(productId)] = quantity;
                else delete next[String(productId)];
                return next;
            });
        };
        if (!list.length) return h("div", { className: "react-empty react-panel" }, "\u0422\u043e\u0432\u0430\u0440\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.");
        return h("div", { className: "react-products-grid" }, list.map(p => h(ProductCard, { key: p.id, product: p, favorite, cartQuantity: cartItems[String(p.id)] || 0, onCartQuantityChange: setProductQuantity })));
    }
    function SearchEmptyState() {
        return h("div", { className: "react-empty react-panel react-stack" }, [
            h("p", null, "\u041f\u043e \u0432\u0430\u0448\u0435\u043c\u0443 \u0437\u0430\u043f\u0440\u043e\u0441\u0443 \u043d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e."),
            h("p", { className: "react-muted" }, "\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u0444\u043e\u0440\u043c\u0443\u043b\u0438\u0440\u043e\u0432\u043a\u0443: \u043c\u043e\u043b\u043e\u0447\u043a\u0430, \u043e\u0432\u043e\u0449\u0438, \u043a \u0447\u0430\u044e \u0438\u043b\u0438 \u0437\u0430\u0432\u0442\u0440\u0430\u043a.")
        ]);
    }
    function HomePage() {
        const banners = [
            ["/catalog?category=new&sort=newest", "\u041d\u041e\u0412\u0418\u041d\u041a\u0418\n\u041d\u0415\u0414\u0415\u041b\u0418", "\u0421\u0432\u0435\u0436\u0438\u0435 \u043f\u043e\u0441\u0442\u0430\u0432\u043a\u0438", "tone-orange"],
            ["/catalog?category=sale", "\u0417\u0415\u041b\u0415\u041d\u042b\u0415\n\u0426\u0415\u041d\u041d\u0418\u041a\u0418", "\u0422\u043e\u0432\u0430\u0440\u044b \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439", "tone-green"],
            ["/catalog?category=\u0444\u0440\u0443\u043a\u0442\u044b", "\u0424\u0420\u0423\u041a\u0422\u042b\n\u0418 \u042f\u0413\u041e\u0414\u042b", "\u0421\u0435\u0437\u043e\u043d\u043d\u0430\u044f \u043f\u043e\u043b\u043a\u0430", "tone-pink"],
            ["/catalog?category=popular&sort=popular", "\u0425\u0418\u0422\u042b", "\u0427\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043e \u0431\u0435\u0440\u0443\u0442", "tone-yellow"]
        ];
        const sections = props.home_sections || [];
        const fallbackSection = !sections.length && (props.products || []).length
            ? [{
                id: "recommended",
                title: "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c \u0441\u0435\u0433\u043e\u0434\u043d\u044f",
                text: "\u041f\u0435\u0440\u0432\u044b\u0435 \u0442\u043e\u0432\u0430\u0440\u044b \u0438\u0437 \u043e\u0431\u0449\u0435\u0439 \u0432\u0438\u0442\u0440\u0438\u043d\u044b.",
                href: "/catalog",
                products: (props.products || []).slice(0, 8)
            }]
            : [];
        const homeSections = sections.length ? sections : fallbackSection;
        return h(React.Fragment, null, [
            h("div", { className: "react-hero-banners" }, banners.map(([href, title, text, tone]) => A({ key: href, href, className: `react-banner ${tone}` }, [
                h("span", { key: "copy", className: "react-banner-copy" }, [
                    h("strong", null, title.split("\n").map((line, i) => h(React.Fragment, { key: i }, [line, i === 0 && title.includes("\n") ? h("br") : null]))),
                    h("small", null, text)
                ])
            ]))),
            h("div", { className: "react-home-shelves" }, homeSections.map(section =>
                h("section", { key: section.id || section.title, className: "react-home-shelf" }, [
                    h("div", { className: "react-home-shelf-head" }, [
                        h("div", null, [
                            h("h2", null, section.title),
                            section.text ? h("p", null, section.text) : null
                        ]),
                        section.href ? A({ href: section.href, className: "react-btn secondary" }, "\u0421\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u0441\u0435") : null
                    ]),
                    h(ProductsGrid, { products: section.products || [] })
                ])
            ))
        ]);
    }

    function CatalogPage() {
        const specialCategories = {
            new: "\u041d\u043e\u0432\u0438\u043d\u043a\u0438",
            sale: "\u0417\u0435\u043b\u0451\u043d\u044b\u0435 \u0446\u0435\u043d\u043d\u0438\u043a\u0438",
            popular: "\u0425\u0438\u0442\u044b"
        };
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
        const categoryIcons = {
            "": "layout-grid",
            "\u043c\u043e\u043b\u043e\u043a\u043e": "milk",
            "\u043c\u044f\u0441\u043e": "beef",
            "\u043e\u0432\u043e\u0449\u0438": "carrot",
            "\u0444\u0440\u0443\u043a\u0442\u044b": "apple",
            "\u044f\u0433\u043e\u0434\u044b": "cherry",
            "\u0441\u044b\u0440": "pizza",
            "\u043a\u0443\u0440\u0438\u0446\u0430": "drumstick",
            "\u044f\u0439\u0446\u0430": "egg",
            "\u043c\u0451\u0434": "flower-2",
            "\u0445\u043b\u0435\u0431": "wheat",
            "\u0431\u0430\u043a\u0430\u043b\u0435\u044f": "package",
            "\u043a\u043e\u043d\u0441\u0435\u0440\u0432\u044b": "archive",
            "\u0437\u0430\u043c\u043e\u0440\u043e\u0437\u043a\u0430": "snowflake",
            "\u043d\u0430\u043f\u0438\u0442\u043a\u0438": "cup-soda",
            "\u0441\u043b\u0430\u0434\u043e\u0441\u0442\u0438": "cookie"
        };
        const promoLinks = [
            { category: "sale", sort: "rating", title: "\u0417\u0435\u043b\u0451\u043d\u044b\u0435 \u0446\u0435\u043d\u044b", text: "\u0422\u043e\u0432\u0430\u0440\u044b \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439", icon: "badge-percent", tone: "green" },
            { category: "new", sort: "newest", title: "\u041d\u043e\u0432\u0438\u043d\u043a\u0438", text: "\u0421\u0432\u0435\u0436\u0438\u0435 \u043f\u043e\u0441\u0442\u0430\u0432\u043a\u0438", icon: "sparkles", tone: "cream" },
            { category: "popular", sort: "popular", title: "\u0425\u0438\u0442\u044b", text: "\u0427\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043e \u0431\u0435\u0440\u0443\u0442", icon: "flame", tone: "yellow" }
        ];
        const buildCatalogHref = (overrides = {}) => {
            const params = new URLSearchParams();
            const category = Object.prototype.hasOwnProperty.call(overrides, "category")
                ? overrides.category
                : (props.category || "");
            const sort = Object.prototype.hasOwnProperty.call(overrides, "sort")
                ? overrides.sort
                : (props.sort || "rating");
            const minPrice = Object.prototype.hasOwnProperty.call(overrides, "min_price")
                ? overrides.min_price
                : props.min_price;
            const maxPrice = Object.prototype.hasOwnProperty.call(overrides, "max_price")
                ? overrides.max_price
                : props.max_price;
            const inStock = Object.prototype.hasOwnProperty.call(overrides, "in_stock")
                ? overrides.in_stock
                : (props.in_stock || "");
            const page = Object.prototype.hasOwnProperty.call(overrides, "page")
                ? overrides.page
                : Number(props.page_num || 1);
            if (category) params.set("category", category);
            if (sort && sort !== "rating") params.set("sort", sort);
            if (minPrice !== undefined && minPrice !== null && minPrice !== "") params.set("min_price", String(minPrice));
            if (maxPrice !== undefined && maxPrice !== null && maxPrice !== "") params.set("max_price", String(maxPrice));
            if (inStock === "1") params.set("in_stock", "1");
            if (page > 1) params.set("page", String(page));
            const query = params.toString();
            return query ? `/catalog?${query}` : "/catalog";
        };
        const [selectedSort, setSelectedSort] = React.useState(props.sort || "rating");
        const [selectedStock, setSelectedStock] = React.useState(props.in_stock || "");
        React.useEffect(() => {
            setSelectedSort(props.sort || "rating");
            setSelectedStock(props.in_stock || "");
        }, [props.sort, props.in_stock]);
        const sortOptions = [
            { value: "rating", label: "\u0420\u0435\u0439\u0442\u0438\u043d\u0433: \u0432\u044b\u0448\u0435" },
            { value: "rating_asc", label: "\u0420\u0435\u0439\u0442\u0438\u043d\u0433: \u043d\u0438\u0436\u0435" },
            { value: "popular", label: "\u041f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0435" },
            { value: "newest", label: "\u041d\u043e\u0432\u0438\u043d\u043a\u0438" },
            { value: "price_asc", label: "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0434\u0435\u0448\u0435\u0432\u043b\u0435" },
            { value: "price_desc", label: "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0434\u043e\u0440\u043e\u0436\u0435" }
        ];
        const pageNum = Number(props.page_num || 1);
        const totalPages = Number(props.total_pages || 1);
        const makeCatalogPageHref = targetPage => {
            if (page === "search") {
                const searchParams = new URLSearchParams();
                if (props.q) searchParams.set("q", props.q);
                searchParams.set("page", String(targetPage));
                return `/search?${searchParams.toString()}`;
            }
            return buildCatalogHref({ page: targetPage });
        };
        const catalogResetHref = buildCatalogHref({
            sort: "rating",
            min_price: "",
            max_price: "",
            in_stock: "",
            page: 1
        });
        const hasActiveFilters = Boolean(
            props.category
            || (props.sort && props.sort !== "rating")
            || props.min_price
            || props.max_price
            || props.in_stock
        );
        const totalProducts = Number(props.total ?? (props.products || []).length);
        const pageProductCount = (props.products || []).length;
        const resultCountLabel = totalPages > 1 && totalProducts > pageProductCount
            ? `${pageProductCount} из ${totalProducts} товаров`
            : `${totalProducts} товаров`;
        const activeCategoryLabel = specialCategories[props.category]
            || (categories.find(item => item.value === props.category) || categories[0]).label;
        const activeCategoryInput = props.category ? h("input", { type: "hidden", name: "category", value: props.category }) : null;
        const sortLabel = (sortOptions.find(item => item.value === (props.sort || "rating")) || sortOptions[0]).label;
        const activeFilters = [
            props.category ? `\u041f\u043e\u043b\u043a\u0430: ${activeCategoryLabel}` : null,
            props.sort && props.sort !== "rating" ? sortLabel : null,
            props.min_price ? `\u043e\u0442 ${props.min_price} \u0440\u0443\u0431` : null,
            props.max_price ? `\u0434\u043e ${props.max_price} \u0440\u0443\u0431` : null,
            props.in_stock ? "\u0412 \u043d\u0430\u043b\u0438\u0447\u0438\u0438" : null
        ].filter(Boolean);
        const catalogForm = page !== "favorites" && page !== "search" && h("form", { action: "/catalog", method: "get", className: "react-catalog-filter-card react-form-grid", onSubmit: omitEmptyGetFields }, [
                    activeCategoryInput,
                    h("input", { key: "page-reset", type: "hidden", name: "page", value: "1" }),
                    h("div", { key: "head", className: "wide react-catalog-filter-head" }, [
                        h("div", null, [
                            h("strong", { className: "react-filter-title" }, "\u0423\u0442\u043e\u0447\u043d\u0438\u0442\u044c"),
                            h("span", { className: "react-muted" }, props.category ? `\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f: ${activeCategoryLabel}` : "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e \u0432\u044b\u0431\u0438\u0440\u0430\u0439\u0442\u0435 \u0441\u043b\u0435\u0432\u0430")
                        ]),
                        hasActiveFilters
                            ? A({ href: catalogResetHref, className: "react-btn secondary" }, "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b")
                            : null
                    ]),
                    activeFilters.length ? h("div", { key: "active", className: "wide react-active-filters" }, activeFilters.map(item =>
                        h("span", { key: item, className: "react-filter-pill" }, item)
                    )) : null,
                    h("div", { key: "sort", className: "wide react-filter-group" }, [
                        h("strong", { className: "react-filter-title" }, "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c"),
                        h("div", { className: "react-segment-row" }, sortOptions.map(item => h("button", {
                            type: "button",
                            className: `react-segment${selectedSort === item.value ? " active" : ""}`,
                            onClick: () => setSelectedSort(item.value),
                            "aria-pressed": selectedSort === item.value ? "true" : "false"
                        }, item.label))),
                        h("input", { type: "hidden", name: "sort", value: selectedSort || "rating" })
                    ]),
                    h("label", { key: "price", className: "react-filter-group react-price-filter" }, [
                        h("strong", { className: "react-filter-title" }, "\u0426\u0435\u043d\u0430"),
                        h("div", { className: "react-price-filter-inputs" }, [
                            Field({ key: "min", name: "min_price", type: "number", step: "0.01", min: "0", placeholder: "\u043e\u0442", defaultValue: props.min_price || "" }),
                            Field({ key: "max", name: "max_price", type: "number", step: "0.01", min: "0", placeholder: "\u0434\u043e", defaultValue: props.max_price || "" })
                        ])
                    ]),
                    h("div", { key: "quick", className: "react-filter-group" }, [
                        h("strong", { className: "react-filter-title" }, "\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u044f"),
                        h("div", { className: "react-toggle-row" }, [
                            h("button", {
                                type: "button",
                                className: `react-toggle-pill${selectedStock === "1" ? " active" : ""}`,
                                onClick: () => setSelectedStock(value => value === "1" ? "" : "1"),
                                "aria-pressed": selectedStock === "1" ? "true" : "false"
                            }, "\u0412 \u043d\u0430\u043b\u0438\u0447\u0438\u0438")
                        ]),
                        h("input", { key: "stock-hidden", type: "hidden", name: "in_stock", value: selectedStock })
                    ]),
                    h("button", { key: "submit", className: "react-btn react-filter-submit", type: "submit" }, "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c")
                ]);
        const content = page === "search" && !(props.products || []).length
            ? h(SearchEmptyState)
            : h(React.Fragment, null, [
                h(ProductsGrid, { key: "grid", products: props.products || [], favorite: page === "favorites" }),
                totalPages > 1 && h("div", { key: "pager", className: "react-actions react-catalog-pager" }, [
                    pageNum > 1 ? ButtonLink({ href: makeCatalogPageHref(pageNum - 1), className: "secondary" }, "\u041d\u0430\u0437\u0430\u0434") : h("span"),
                    h("span", { className: "react-muted" }, `${pageNum} / ${totalPages}`),
                    pageNum < totalPages ? ButtonLink({ href: makeCatalogPageHref(pageNum + 1), className: "secondary" }, "\u0414\u0430\u043b\u0435\u0435") : h("span")
                ])
            ]);
        if (page === "favorites" || page === "search") {
        return h(React.Fragment, null, [
                h("div", { className: "react-page-title" }, [page === "search" ? null : h("h1", null, "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435"), h("span", { className: "react-muted" }, resultCountLabel)]),
                props.search_hint && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.search_hint),
                content
            ]);
        }
        return h("div", { className: "react-catalog-page" }, [
            h("section", { className: "react-catalog-hero" }, [
                h("div", { className: "react-catalog-kicker" }, "\u0424\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0430\u044f \u0432\u0438\u0442\u0440\u0438\u043d\u0430"),
                h("div", { className: "react-page-title" }, [
                    h("h1", null, "\u041a\u0430\u0442\u0430\u043b\u043e\u0433"),
                    h("span", { className: "react-muted" }, resultCountLabel)
                ]),
                h("p", null, "\u0412\u044b\u0431\u0438\u0440\u0430\u0439\u0442\u0435 \u0441\u0432\u0435\u0436\u0438\u0435 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u044b \u043f\u043e \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f\u043c, \u0441\u043e\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u043f\u043e \u0446\u0435\u043d\u0435 \u0438 \u043d\u0430\u043b\u0438\u0447\u0438\u044e, \u0430 \u043c\u044b \u043d\u0435 \u043f\u0443\u0441\u0442\u0438\u043c \u0432\u0430\u0441 \u043d\u0430 \u043f\u0443\u0441\u0442\u0443\u044e \u043f\u043e\u043b\u043a\u0443.")
            ]),
            h("div", { className: "react-catalog-promo-row" }, promoLinks.map(item =>
                A({
                    key: item.category,
                    href: buildCatalogHref({ category: item.category, sort: item.sort, page: 1 }),
                    className: `react-catalog-promo tone-${item.tone}${(props.category || "") === item.category ? " active" : ""}`
                }, [
                    h("span", { className: "react-catalog-promo-icon" }, Icon({ name: item.icon })),
                    h("strong", null, item.title),
                    h("small", null, item.text)
                ])
            )),
            h("div", { className: "react-catalog-layout" }, [
                h("aside", { className: "react-catalog-sidebar" }, [
                    h("h2", null, "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438"),
                    h("nav", null, categories.map(c => A({
                        key: c.value || "all",
                        href: buildCatalogHref({
                            category: c.value,
                            sort: props.sort || "rating",
                            page: 1
                        }),
                        className: `react-catalog-side-link${(props.category || "") === c.value ? " active" : ""}`
                    }, [
                        h("span", null, Icon({ name: categoryIcons[c.value] || "leaf" })),
                        h("b", null, c.label)
                    ])))
                ]),
                h("section", { className: "react-catalog-content" }, [
                    h("div", { className: "react-catalog-toolbar" }, [
                        h("div", null, [
                            h("span", { className: "react-catalog-kicker" }, activeCategoryLabel),
                            h("h2", null, "\u0422\u043e\u0432\u0430\u0440\u044b \u043d\u0430 \u043f\u043e\u043b\u043a\u0435")
                        ]),
                        h("span", { className: "react-muted" }, totalPages > 1 ? `\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 ${pageNum} \u0438\u0437 ${totalPages}` : "\u0412\u0441\u0451 \u043d\u0430 \u043e\u0434\u043d\u043e\u0439 \u043f\u043e\u043b\u043a\u0435")
                    ]),
                    catalogForm,
                    content
                ])
            ])
        ]);
    }
    function ProductSpecItem({ label, value, href, valueClassName }) {
        const valueClass = ["react-product-spec-value", valueClassName].filter(Boolean).join(" ");
        const valueNode = href
            ? A({ href, className: valueClass }, value)
            : h("div", { className: valueClass }, value);
        return h("div", { className: "react-product-spec-item" }, [
            h("div", { className: "react-product-spec-label" }, label),
            valueNode
        ]);
    }
    function ProductPage() {
        const product = props.product || {};
        const status = stockStatus(product);
        const [cartQty, setCartQty] = React.useState(0);
        React.useEffect(() => {
            let alive = true;
            if (user && user.role === "user" && product.id && window.fetch) {
                fetch("/cart/state", { credentials: "same-origin" })
                    .then(response => response.ok ? response.json() : { items: {}, position_count: 0 })
                    .then(data => {
                        if (!alive) return;
                        setCartQty(Number((data.items && data.items[String(product.id)]) || 0));
                        notifyCartState(data);
                    })
                    .catch(() => {});
            }
            return () => {
                alive = false;
            };
        }, [product.id]);
        return h(React.Fragment, null, [
            h("section", { className: "react-product-detail" }, [
                h("div", { className: "react-product-detail-image react-panel" },
                    h(ProductGallery, { product })
                ),
                h("div", { className: "react-panel react-stack" }, [
                    h("div", { className: "react-chip-row" }, [product.category && h("span", { className: "react-chip" }, product.category)]),
                    h("h1", null, product.name),
                    h(PriceDisplay, { product }),
                    h("p", null, product.description || "\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u044b\u0439 \u0444\u0435\u0440\u043c\u0435\u0440\u0441\u043a\u0438\u0439 \u043f\u0440\u043e\u0434\u0443\u043a\u0442 \u0441 \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u043c \u0441\u043e\u0441\u0442\u0430\u0432\u043e\u043c \u0438 \u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u043e\u0439 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u043e\u0439."),
                    h("div", { className: "react-product-spec-grid", role: "list" }, [
                        ProductSpecItem({
                            label: "\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446",
                            value: ownerName(product),
                            href: sellerLink(product) || undefined
                        }),
                        ProductSpecItem({
                            label: "\u0420\u0435\u0433\u0438\u043e\u043d",
                            value: product.region || "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f"
                        }),
                        product.owner && Number(product.owner.pickup_enabled == null ? 1 : product.owner.pickup_enabled) === 1 && sellerPickupAddress(product.owner)
                            ? ProductSpecItem({
                                label: "\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437",
                                value: sellerPickupAddress(product.owner)
                            })
                            : null,
                        ProductSpecItem({
                            label: "\u0424\u0430\u0441\u043e\u0432\u043a\u0430",
                            value: product.weight_per_unit || "\u041f\u043e \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0435\u043d\u043d\u043e\u0441\u0442\u0438"
                        }),
                        ProductSpecItem({
                            label: "\u041e\u0441\u0442\u0430\u0442\u043e\u043a",
                            value: stockText(product),
                            valueClassName: `react-stock-value stock-${status}`
                        }),
                        ProductSpecItem({
                            label: "\u0421\u0440\u043e\u043a \u0433\u043e\u0434\u043d\u043e\u0441\u0442\u0438",
                            value: product.expiration_days ? `${product.expiration_days} \u0434\u043d.` : "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f"
                        })
                    ]),
                    h("div", { className: "react-actions" }, [
                        h(ProductCartControl, { product, quantity: cartQty, onQuantityChange: (_productId, quantity) => setCartQty(quantity) }),
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
        return h("section", { className: "react-panel react-product-reviews" }, [
            h("div", { className: "react-page-title" }, [h("h2", null, "\u041e\u0442\u0437\u044b\u0432\u044b"), A({ href: props.product ? `/reviews/product/${props.product.id}` : "/reviews", className: "react-btn secondary" }, "\u0412\u0441\u0435 \u043e\u0442\u0437\u044b\u0432\u044b")]),
            (reviews || []).length ? h("div", { className: "react-stack" }, reviews.map(r => h("div", { key: r.id || (r.review && r.review.id), className: "react-card" }, [
                h("div", { className: "react-review-stars", "aria-label": `\u041e\u0446\u0435\u043d\u043a\u0430 ${(r.review || r).rating || 0} \u0438\u0437 5` }, renderStars((r.review || r).rating || 0)),
                h("p", null, (r.review || r).text || "\u0411\u0435\u0437 \u0442\u0435\u043a\u0441\u0442\u0430"),
                h(ReviewResponse, { response: (r.review || r).seller_response })
            ]))) : h("div", { className: "react-empty" }, "\u041e\u0442\u0437\u044b\u0432\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    const authRouteSet = new Set(["login", "forgot_password", "forgot_password_sent", "reset_password", "register", "become_seller"]);
    function AuthLink({ href, onClick, className, children }, fallbackChildren) {
        return A({ href, className, onClick }, children || fallbackChildren);
    }
    function LoginContent({ onSwitch, onSubmit, errorText }) {
        const loginError = errorText || props.error;
        return [
            props.password_reset_success && h("p", { className: "alert alert-success" }, "\u041f\u0430\u0440\u043e\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d. \u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0441 \u043d\u043e\u0432\u044b\u043c \u043f\u0430\u0440\u043e\u043b\u0435\u043c."),
            loginError && h("p", { className: "alert alert-danger" }, loginError),
            h("form", { action: "/login", method: "post", className: "react-stack", onSubmit: onSubmit || handleSubmitOnce }, [
                Field({ name: "email", type: "email", placeholder: "Email", defaultValue: props.email, required: true }),
                Field({ name: "password", type: "password", placeholder: "\u041f\u0430\u0440\u043e\u043b\u044c", required: true }),
                h("button", { className: "react-btn", type: "submit" }, "\u0412\u043e\u0439\u0442\u0438")
            ]),
            h("div", { className: "react-auth-links" }, [
                h("p", { key: "forgot" }, AuthLink({ href: "/forgot-password", onClick: event => { event.preventDefault(); onSwitch("forgot_password"); } }, "\u0417\u0430\u0431\u044b\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c?")),
                h("p", { key: "buyer" }, ["\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430? ", AuthLink({ href: "/register", onClick: event => { event.preventDefault(); onSwitch("register"); } }, "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f")])
            ])
        ];
    }
    function AuthModal({ open, onClose, title, subtitle, children, className, wide }) {
        if (!open) return null;
        const cardClassName = ["react-auth-card", className, wide ? "react-auth-card-wide" : "react-auth-card-modal"].filter(Boolean).join(" ");
        return h("div", { className: "react-modal-overlay react-auth-overlay", onClick: onClose }, [
            h("section", {
                key: "dialog",
                className: cardClassName,
                role: "dialog",
                "aria-modal": "true",
                "aria-label": title,
                onClick: event => event.stopPropagation()
            }, [
                h("button", { key: "close", type: "button", className: "react-auth-close", "aria-label": "\u0417\u0430\u043a\u0440\u044b\u0442\u044c", onClick: onClose }, "\u00d7"),
                h("div", { key: "body", className: "react-auth-card-body" }, [
                    h("header", { key: "header", className: "react-auth-header" }, [
                        h("h1", { key: "title", className: "react-auth-title" }, title),
                        subtitle ? h("p", { key: "subtitle", className: "react-auth-subtitle" }, subtitle) : null
                    ]),
                    ...(children || [])
                ])
            ])
        ]);
    }
    function AuthViewConfig(view) {
        return {
            login: {
                title: "\u0412\u0445\u043e\u0434",
                subtitle: "\u0412\u043e\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u043f\u043e\u043a\u0443\u043f\u043a\u0438 \u0438 \u0443\u043f\u0440\u0430\u0432\u043b\u044f\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u043e\u043c.",
                wide: false,
                className: ""
            },
            forgot_password: {
                title: "\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c",
                subtitle: "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 email, \u0438 \u043c\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043c \u0441\u0441\u044b\u043b\u043a\u0443 \u0434\u043b\u044f \u0441\u0431\u0440\u043e\u0441\u0430.",
                wide: false,
                className: "react-auth-card-slim"
            },
            forgot_password_sent: {
                title: "\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u0447\u0442\u0443",
                subtitle: "\u0415\u0441\u043b\u0438 email \u0435\u0441\u0442\u044c \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0435, \u043c\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u0441\u0441\u044b\u043b\u043a\u0443 \u0434\u043b\u044f \u0441\u0431\u0440\u043e\u0441\u0430 \u043f\u0430\u0440\u043e\u043b\u044f.",
                wide: false,
                className: "react-auth-card-slim"
            },
            reset_password: {
                title: "\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c",
                subtitle: "\u0417\u0430\u0434\u0430\u0439\u0442\u0435 \u043d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u0432 \u0430\u043a\u043a\u0430\u0443\u043d\u0442.",
                wide: false,
                className: "react-auth-card-slim"
            },
            register: {
                title: "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f",
                subtitle: "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0424\u0418\u041e, \u0442\u0435\u043b\u0435\u0444\u043e\u043d \u0438 email \u2014 \u044d\u0442\u0438 \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u043e\u0434\u0441\u0442\u0430\u0432\u044f\u0442\u0441\u044f \u043f\u0440\u0438 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0438 \u0437\u0430\u043a\u0430\u0437\u0430.",
                wide: true,
                className: "react-auth-card-wide"
            },
            become_seller: {
                title: "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c",
                subtitle: "\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0443\u044e \u0437\u0430\u044f\u0432\u043a\u0443. \u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b \u0441\u0432\u044f\u0436\u0435\u0442\u0441\u044f \u0441 \u0432\u0430\u043c\u0438 \u0434\u043b\u044f \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u044f \u0434\u0430\u043d\u043d\u044b\u0445 \u0438 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f.",
                wide: true,
                className: "react-auth-card-wide"
            }
        }[view] || {
            title: "\u0412\u0445\u043e\u0434",
            subtitle: "",
            wide: false,
            className: ""
        };
    }
    function AuthTabs({ active, onSwitch }) {
        return h("div", { className: "react-tab-row", style: { marginBottom: 18 } }, [
            h("button", { key: "buyer", type: "button", className: `react-btn ${active === "buyer" ? "" : "secondary"}`, onClick: () => onSwitch("register") }, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c"),
            h("button", { key: "seller", type: "button", className: `react-btn ${active === "seller" ? "" : "secondary"}`, onClick: () => onSwitch("become_seller") }, "\u0421\u0442\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c")
        ]);
    }
    function AuthViewBody({ view, onSwitch, submitLoginInline, loginError }) {
        if (view === "forgot_password") {
            return [
            props.error && h("p", { className: "alert alert-danger" }, props.error),
                h("form", { action: "/forgot-password", method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                Field({ name: "email", type: "email", placeholder: "Email", defaultValue: props.email, required: true }),
                    h("button", { className: "react-btn", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c")
                ]),
                h("div", { className: "react-auth-links" }, [
                    h("p", null, AuthLink({ href: "/login", onClick: event => { event.preventDefault(); onSwitch("login"); } }, "\u0412\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a \u0432\u0445\u043e\u0434\u0443"))
                ])
            ];
        }
        if (view === "forgot_password_sent") {
            return [
                props.mail_sent === false && props.reset_link ? h("p", { className: "react-muted" }, "\u0414\u043b\u044f \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e\u0439 \u0434\u0435\u043c\u043e-\u0441\u0440\u0435\u0434\u044b SMTP \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u0441\u0441\u044b\u043b\u043a\u0430 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0430 \u043d\u0438\u0436\u0435.") : null,
                props.reset_link ? ButtonLink({ href: props.reset_link }, "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c") : null,
                h("button", { type: "button", className: "react-btn secondary", key: "back", onClick: () => onSwitch("login") }, "\u041a\u043e \u0432\u0445\u043e\u0434\u0443")
            ];
        }
        if (view === "reset_password") {
            const canSubmit = Boolean(props.token);
            return [
                props.error && h("p", { className: "alert alert-danger" }, props.error),
                canSubmit ? h("form", { action: "/reset-password", method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                    h("input", { name: "token", type: "hidden", value: props.token }),
                    Field({ name: "password", type: "password", placeholder: "\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c", required: true, minLength: 6 }),
                    Field({ name: "password_confirm", type: "password", placeholder: "\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c", required: true, minLength: 6 }),
                    h("button", { className: "react-btn", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c")
                ]) : h("button", { type: "button", className: "react-btn", onClick: () => onSwitch("forgot_password") }, "\u0417\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u044c \u043d\u043e\u0432\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443"),
                h("div", { className: "react-auth-links" }, [
                    h("p", null, AuthLink({ href: "/login", onClick: event => { event.preventDefault(); onSwitch("login"); } }, "\u041a\u043e \u0432\u0445\u043e\u0434\u0443"))
                ])
            ];
        }
        if (view === "register") {
            return [
                h(AuthTabs, { active: "buyer", onSwitch }),
                props.error && h("p", { className: "alert alert-danger" }, props.error),
                h("form", { action: "/register", method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                    Field({ name: "full_name", placeholder: "\u0424\u0418\u041e", defaultValue: props.full_name || "", required: true, maxLength: 255 }),
                    PhoneField({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: props.phone || "", required: true }),
                    Field({ name: "email", type: "email", placeholder: "Email", defaultValue: props.email || "", required: true }),
                    Field({ name: "password", type: "password", placeholder: "\u041f\u0430\u0440\u043e\u043b\u044c", required: true, minLength: 6 }),
                    h("button", { className: "react-btn", type: "submit" }, "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442")
                ]),
                h("div", { className: "react-auth-links" }, [
                    h("p", null, AuthLink({ href: "/login", onClick: event => { event.preventDefault(); onSwitch("login"); } }, "\u0423\u0436\u0435 \u0435\u0441\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442? \u0412\u043e\u0439\u0442\u0438")),
                    h("p", { className: "react-muted" }, "\u0414\u043b\u044f \u043f\u0440\u043e\u0434\u0430\u0436 \u043d\u0430 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0435 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u0443\u044e \u0430\u043d\u043a\u0435\u0442\u0443 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430.")
                ])
            ];
        }
        if (view === "become_seller") {
            return [
                props.error && h("p", { className: "alert alert-danger" }, props.error),
                h(SellerApplicationForm, { compact: false })
            ];
        }
        return [
            props.password_reset_success && h("p", { className: "alert alert-success" }, "\u041f\u0430\u0440\u043e\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d. \u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0441 \u043d\u043e\u0432\u044b\u043c \u043f\u0430\u0440\u043e\u043b\u0435\u043c."),
            loginError && h("p", { className: "alert alert-danger" }, loginError),
            h("form", { action: "/login", method: "post", className: "react-stack", onSubmit: submitLoginInline || handleSubmitOnce }, [
                Field({ name: "email", type: "email", placeholder: "Email", defaultValue: props.email, required: true }),
                Field({ name: "password", type: "password", placeholder: "\u041f\u0430\u0440\u043e\u043b\u044c", required: true }),
                h("button", { className: "react-btn", type: "submit" }, "\u0412\u043e\u0439\u0442\u0438")
            ]),
            h("div", { className: "react-auth-links" }, [
                h("p", { key: "forgot" }, AuthLink({ href: "/forgot-password", onClick: event => { event.preventDefault(); onSwitch("forgot_password"); } }, "\u0417\u0430\u0431\u044b\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c?")),
                h("p", { key: "buyer" }, ["\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430? ", AuthLink({ href: "/register", onClick: event => { event.preventDefault(); onSwitch("register"); } }, "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f")])
            ])
        ];
    }
    function AuthFlowModal({ open, view, onClose, onSwitch }) {
        const [loginError, setLoginError] = React.useState("");
        React.useEffect(() => {
            if (!open) return undefined;
            const handleKeyDown = event => {
                if (event.key === "Escape") onClose();
            };
            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }, [open, onClose]);
        React.useEffect(() => {
            if (view !== "login") {
                setLoginError("");
            }
        }, [view]);
        const submitLoginInline = React.useCallback(async event => {
            event.preventDefault();
            const form = event.currentTarget;
            if (!form || typeof window.fetch !== "function") {
                form.submit();
                return;
            }
            setLoginError("");
            try {
                const formData = new FormData(form);
                const response = await fetch("/login", {
                    method: "POST",
                    body: formData,
                    credentials: "same-origin"
                });
                const finalUrl = response.url || "";
                if (finalUrl && !finalUrl.endsWith("/login")) {
                    window.location.assign(finalUrl);
                    return;
                }
                const html = await response.text();
                let nextError = "Неверный email или пароль";
                try {
                    const doc = new DOMParser().parseFromString(html, "text/html");
                    const alert = doc.querySelector(".alert-danger");
                    if (alert && alert.textContent) {
                        nextError = alert.textContent.trim();
                    }
                } catch (_err) {}
                setLoginError(nextError);
            } catch (_err) {
                setLoginError("Не удалось войти. Проверьте логин и пароль и попробуйте ещё раз.");
            }
        }, []);
        if (!open || !view) return null;
        const meta = AuthViewConfig(view);
        return AuthModal({
            open,
            onClose,
            title: meta.title,
            subtitle: meta.subtitle,
            className: meta.className,
            wide: meta.wide,
            children: [h("div", { className: "react-auth-body" }, AuthViewBody({ view, onSwitch, submitLoginInline, loginError }))]
        });
    }
    function SellerPendingPage() {
        const status = props.application_status || "pending";
        const displayStatus = status === "new" ? "pending" : status;
        const rejected = status === "rejected";
        return h("section", { className: "react-panel react-stack", style: { maxWidth: 760, margin: "0 auto" } }, [
            h("h1", null, "\u0410\u043d\u043a\u0435\u0442\u0430 \u0444\u0435\u0440\u043c\u0435\u0440\u0430"),
            props.notice_message ? h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35", background: "#f6fbf2" } }, props.notice_message) : null,
            h("div", { className: "react-chip-row" }, [
                h("span", { className: "react-chip" }, sellerApplicationStatusText(displayStatus)),
                props.application_number ? h("span", { className: "react-chip" }, `\u2116 ${props.application_number}`) : null
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
        const [paymentMethod, setPaymentMethod] = React.useState("yookassa");
        const [minOrderNoticeOpen, setMinOrderNoticeOpen] = React.useState(false);
        const [couponCode, setCouponCode] = React.useState(checkout.coupon_code || "");
        const [couponPreview, setCouponPreview] = React.useState(null);
        const [couponError, setCouponError] = React.useState("");
        const [couponLoading, setCouponLoading] = React.useState(false);
        const slotOptions = [
            { value: "10-14", label: "10:00 - 14:00", endHour: 14 },
            { value: "14-18", label: "14:00 - 18:00", endHour: 18 },
            { value: "18-22", label: "18:00 - 22:00", endHour: 22 }
        ];
        const minOrderAmount = Number(props.min_order_amount || 3000);
        const minOrderShortage = Math.max(0, Number(props.min_order_shortage != null ? props.min_order_shortage : (minOrderAmount - goodsTotal)));
        const hasMinOrderErrors = minOrderShortage > 0;
        const minOrderText = `\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430 \u0437\u0430\u043a\u0430\u0437\u0430: ${money(minOrderAmount)}`;
        const minOrderMessage = props.min_order_message || `\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430 \u0437\u0430\u043a\u0430\u0437\u0430: ${money(minOrderAmount)}. \u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u0435\u0449\u0451 \u043d\u0430 ${money(minOrderShortage)}.`;
        const activeGroups = groups.filter(group => (group.cart_items || []).length > 0);
        const multipleSellers = activeGroups.length > 1;
        const [cdekChoices, setCdekChoices] = React.useState(() => {
            const initial = {};
            activeGroups.forEach(group => {
                const key = group.seller_id === null || group.seller_id === undefined ? "__none__" : String(group.seller_id);
                initial[key] = { city: "\u041c\u043e\u0441\u043a\u0432\u0430", city_code: "44", delivery_type: "pickup", delivery_point: "", points: [], quote: null, message: "" };
            });
            return initial;
        });
        const [deliveryChoices, setDeliveryChoices] = React.useState(() => {
            const initial = {};
            activeGroups.forEach(group => {
                const key = group.seller_id === null || group.seller_id === undefined ? "__none__" : String(group.seller_id);
                const options = group.delivery_options || [];
                const slots = group.delivery_slots && group.delivery_slots.length ? group.delivery_slots : ["10-14", "14-18", "18-22"];
                initial[key] = { method: checkout.delivery_method || (options[0] && options[0].method) || "pickup", date: defaultDate, slot: checkout.delivery_slot_choice || slots[0] || "10-14" };
            });
            return initial;
        });
        const setChoice = (key, patch) => setDeliveryChoices(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
        const setCdekChoice = (key, patch) => setCdekChoices(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
        const optionFor = (group, method) => (group.delivery_options || []).find(option => option.method === method) || {};
        const selectedDeliveryFee = (group, key, method) => {
            if (method === "partner_delivery" && cdekChoices[key] && cdekChoices[key].quote) {
                return Number(cdekChoices[key].quote.delivery_sum || 0);
            }
            return Number(optionFor(group, method).fee || 0);
        };
        const deliveryTotal = activeGroups.reduce((sum, group) => {
            const key = group.seller_id === null || group.seller_id === undefined ? "__none__" : String(group.seller_id);
            const choice = deliveryChoices[key] || {};
            return sum + selectedDeliveryFee(group, key, choice.method);
        }, 0);
        const discountAmount = couponPreview && couponPreview.ok ? Number(couponPreview.discount_amount || 0) : 0;
        const grandTotal = Math.max(0, goodsTotal + deliveryTotal - discountAmount);
        const applyCoupon = () => {
            const code = (couponCode || "").trim();
            if (!code) {
                setCouponPreview(null);
                setCouponError("");
                return;
            }
            setCouponLoading(true);
            setCouponError("");
            const body = new FormData();
            body.append("coupon_code", code);
            fetch("/cart/coupon/preview", {
                method: "POST",
                body,
                headers: { "X-Requested-With": "XMLHttpRequest" }
            })
                .then(response => response.json())
                .then(data => {
                    if (data.ok) {
                        setCouponPreview(data);
                        setCouponError("");
                    } else {
                        setCouponPreview(null);
                        setCouponError(data.message || "\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.");
                    }
                })
                .catch(() => {
                    setCouponPreview(null);
                    setCouponError("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434.");
                })
                .finally(() => setCouponLoading(false));
        };
        const findCdekCity = (key) => {
            const state = cdekChoices[key] || {};
            const city = (state.city || "").trim();
            if (city.length < 2) {
                setCdekChoice(key, { message: "Введите город." });
                return;
            }
            setCdekChoice(key, { message: "Ищем город СДЭК..." });
            fetch(`/delivery/cdek/cities?city=${encodeURIComponent(city)}`, { headers: { "Accept": "application/json" } })
                .then(response => response.json())
                .then(data => {
                    if (!data.ok || !(data.cities || []).length) throw new Error(data.message || "Город не найден");
                    const cityRow = data.cities[0];
                    setCdekChoice(key, {
                        city: cityRow.city,
                        city_code: String(cityRow.code),
                        message: `${cityRow.city}${cityRow.region ? ", " + cityRow.region : ""}`,
                        points: [],
                        delivery_point: "",
                        quote: null
                    });
                })
                .catch(error => setCdekChoice(key, { message: error.message || "Не удалось найти город СДЭК." }));
        };
        const loadCdekPoints = (key) => {
            const state = cdekChoices[key] || {};
            if (!state.city_code) {
                setCdekChoice(key, { message: "Сначала выберите город СДЭК." });
                return;
            }
            setCdekChoice(key, { message: "Загружаем ПВЗ СДЭК..." });
            fetch(`/delivery/cdek/points?city_code=${encodeURIComponent(state.city_code)}`, { headers: { "Accept": "application/json" } })
                .then(response => response.json())
                .then(data => {
                    if (!data.ok || !(data.points || []).length) throw new Error(data.message || "ПВЗ не найдены");
                    setCdekChoice(key, {
                        points: data.points,
                        delivery_point: data.points[0].code,
                        message: `Найдено ПВЗ: ${data.points.length}`,
                        quote: null
                    });
                })
                .catch(error => setCdekChoice(key, { message: error.message || "Не удалось загрузить ПВЗ СДЭК." }));
        };
        const calculateCdekQuote = (group, key) => {
            const state = cdekChoices[key] || {};
            if (!state.city_code) {
                setCdekChoice(key, { message: "Сначала выберите город СДЭК." });
                return;
            }
            if ((state.delivery_type || "pickup") === "pickup" && !state.delivery_point) {
                setCdekChoice(key, { message: "Выберите ПВЗ СДЭК." });
                return;
            }
            const body = new FormData();
            body.append("seller_id", String(group.seller_id));
            body.append("city_code", String(state.city_code));
            body.append("delivery_type", state.delivery_type || "pickup");
            setCdekChoice(key, { message: "Считаем тариф СДЭК..." });
            fetch("/delivery/cdek/quote", {
                method: "POST",
                body,
                headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }
            })
                .then(response => response.json())
                .then(data => {
                    if (!data.ok) throw new Error(data.message || "СДЭК не рассчитал тариф");
                    const period = data.period_min || data.period_max ? `, ${data.period_min || data.period_max}-${data.period_max || data.period_min} дн.` : "";
                    setCdekChoice(key, { quote: data, message: `Тариф СДЭК: ${money(data.delivery_sum)}${period}` });
                })
                .catch(error => setCdekChoice(key, { quote: null, message: error.message || "Не удалось рассчитать СДЭК." }));
        };
        const hasUnavailableDelivery = activeGroups.some(group => !(group.delivery_options || []).length);
        const needsEmailVerification = props.email_verified === false;
        const handleCheckoutSubmit = event => handleSubmitOnce(event);
        function deliveryBlock(group) {
            const sellerName = group.seller_name || "\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446";
            const key = group.seller_id === null || group.seller_id === undefined ? "__none__" : String(group.seller_id);
            const options = group.delivery_options || [];
            const slots = group.delivery_slots && group.delivery_slots.length ? group.delivery_slots : ["10-14", "14-18", "18-22"];
            const choice = deliveryChoices[key] || { method: options[0] && options[0].method || "pickup", date: defaultDate, slot: slots[0] || "10-14" };
            const cdek = cdekChoices[key] || {};
            const selected = optionFor(group, choice.method);
            const isDelivery = choice.method === "farmer_delivery" || choice.method === "partner_delivery";
            const groupShortage = Math.max(0, Number(group.shortage || 0));
            return h("section", { key: `checkout-${key}`, className: "react-card react-checkout-group" }, [
                h("div", { className: "react-page-title" }, [
                    h("div", null, [h("h3", null, sellerName), h("p", { className: "react-muted" }, multipleSellers ? "\u0411\u0443\u0434\u0435\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0437\u0430\u043a\u0430\u0437 \u0443 \u044d\u0442\u043e\u0433\u043e \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430." : "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043f\u043e\u0441\u043e\u0431 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u044f.")]),
                    h("strong", null, money(Number(group.subtotal || 0) + selectedDeliveryFee(group, key, choice.method)))
                ]),
                groupShortage > 0 && h("span", { className: "react-cart-min-order-warning" }, `\u0414\u043e \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0437\u0430\u043a\u0430\u0437\u0430 \u0443 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430: ${money(groupShortage)}.`),
                options.length ? h("div", { className: "react-checkout-methods" }, options.map(option => {
                    const active = choice.method === option.method;
                    const optionPickup = option.method === "pickup";
                    const optionDelivery = option.method === "farmer_delivery" || option.method === "partner_delivery";
                    const optionPickupAddress = option.address || option.pickup_address || group.pickup_address || sellerPickupAddress(group.seller);
                    const optionLabel = option.method === "partner_delivery" ? CDEK_PROVIDER : option.label || deliveryMethodText(option.method);
                    const optionFee = active ? selectedDeliveryFee(group, key, option.method) : Number(option.fee || 0);
                    return h("div", { key: option.method, className: `react-checkout-method${active ? " is-active" : ""}` }, [
                        h("button", {
                            type: "button",
                            className: `react-chip react-chip-button react-checkout-method-btn${active ? " active" : ""}`,
                            onClick: () => setChoice(key, { method: option.method })
                        }, `${optionLabel} \u00b7 ${money(optionFee)}`),
                        active && optionPickup ? h(PickupAddressBlock, {
                            address: optionPickupAddress,
                            comment: option.comment || ""
                        }) : null,
                        active && optionDelivery && option.method !== "partner_delivery" ? Field({
                            name: `address_${key}`,
                            placeholder: "\u0410\u0434\u0440\u0435\u0441 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438",
                            defaultValue: checkout.address || "",
                            className: "react-checkout-method-field",
                            required: true,
                            maxLength: 500
                        }) : null,
                        active && option.method === "partner_delivery" ? h("div", { className: "react-cdek-delivery-card" }, [
                            h(CdekDeliveryBadge, { method: option.method }),
                            h("div", { className: "react-form-grid" }, [
                                h("input", {
                                    className: "react-input",
                                    name: `cdek_city_${key}`,
                                    placeholder: "\u0413\u043e\u0440\u043e\u0434 \u0421\u0414\u042d\u041a",
                                    value: cdek.city || "",
                                    onChange: e => setCdekChoice(key, { city: e.target.value, city_code: "", points: [], delivery_point: "", quote: null, message: "" }),
                                    required: true,
                                    maxLength: 120
                                }),
                                h("button", { type: "button", className: "react-btn secondary", onClick: () => findCdekCity(key) }, "\u041d\u0430\u0439\u0442\u0438 \u0433\u043e\u0440\u043e\u0434"),
                                h("input", { type: "hidden", name: `cdek_city_code_${key}`, value: cdek.city_code || "" }),
                                h("input", { type: "hidden", name: `cdek_delivery_type_${key}`, value: cdek.delivery_type || "pickup" }),
                                h("input", { type: "hidden", name: `cdek_delivery_point_${key}`, value: cdek.delivery_point || "" }),
                                h("div", { className: "wide react-chip-row" }, [
                                    h("button", { type: "button", className: `react-chip react-chip-button ${(cdek.delivery_type || "pickup") === "pickup" ? "active" : ""}`, onClick: () => setCdekChoice(key, { delivery_type: "pickup", quote: null, message: "" }) }, "\u041f\u0412\u0417"),
                                    h("button", { type: "button", className: `react-chip react-chip-button ${cdek.delivery_type === "door" ? "active" : ""}`, onClick: () => setCdekChoice(key, { delivery_type: "door", quote: null, message: "" }) }, "\u0414\u043e \u0434\u0432\u0435\u0440\u0438")
                                ]),
                                (cdek.delivery_type || "pickup") === "pickup" ? h("div", { className: "wide react-stack" }, [
                                    h("button", { type: "button", className: "react-btn secondary", onClick: () => loadCdekPoints(key) }, "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u041f\u0412\u0417"),
                                    (cdek.points || []).length ? h("select", { className: "react-input", value: cdek.delivery_point || "", onChange: e => setCdekChoice(key, { delivery_point: e.target.value, quote: null, message: "" }) },
                                        (cdek.points || []).map(point => h("option", { key: point.code, value: point.code }, `${point.code} \u00b7 ${point.address || point.name || ""}`))
                                    ) : null
                                ]) : Field({
                                    name: `address_${key}`,
                                    placeholder: "\u0410\u0434\u0440\u0435\u0441 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u0421\u0414\u042d\u041a",
                                    defaultValue: checkout.address || "",
                                    className: "wide",
                                    required: true,
                                    maxLength: 500
                                }),
                                h("button", { type: "button", className: "react-btn", onClick: () => calculateCdekQuote(group, key) }, "\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044c \u0421\u0414\u042d\u041a"),
                                cdek.message ? h("p", { className: "wide react-muted" }, cdek.message) : null
                            ])
                        ]) : null,
                        active && optionDelivery && option.comment ? h("p", { className: "react-muted react-checkout-method-note" }, option.comment) : null
                    ]);
                })) : h("div", { className: "react-cart-min-order-warning" }, "\u0423 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u044b \u0441\u043f\u043e\u0441\u043e\u0431\u044b \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u044f."),
                h("input", { type: "hidden", name: `delivery_method_${key}`, value: choice.method }),
                h("input", { type: "hidden", name: `delivery_slot_choice_${key}`, value: choice.slot }),
                h("div", { className: "react-checkout-schedule react-form-grid" }, [
                    Field({ name: `delivery_date_${key}`, type: "date", defaultValue: choice.date || defaultDate, min: todayStr, className: "wide", onChange: e => setChoice(key, { date: e.target.value }) }),
                    h("div", { className: "wide react-stack react-checkout-slot-block" }, [
                        h("label", { className: "react-muted" }, "\u0412\u0440\u0435\u043c\u0435\u043d\u043d\u043e\u0439 \u0441\u043b\u043e\u0442"),
                        h("div", { className: "react-chip-row react-checkout-slot-row" }, slots.map(slotValue => {
                            const slotMeta = slotOptions.find(slot => slot.value === slotValue) || { value: slotValue, label: slotValue, endHour: 24 };
                            const disabled = (choice.date || defaultDate) === todayStr && today.getHours() >= slotMeta.endHour;
                            return h("button", { key: slotValue, type: "button", disabled, className: `react-chip react-chip-button ${choice.slot === slotValue ? "active" : ""}`, onClick: () => !disabled && setChoice(key, { slot: slotValue }) }, slotMeta.label);
                        }))
                    ]),
                    Textarea({
                        name: `comment_${key}`,
                        placeholder: isDelivery ? "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0434\u043b\u044f \u0444\u0435\u0440\u043c\u0435\u0440\u0430 \u0438\u043b\u0438 \u043a\u0443\u0440\u044c\u0435\u0440\u0430" : "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043a \u0437\u0430\u043a\u0430\u0437\u0443",
                        defaultValue: checkout.comment || "",
                        className: "wide",
                        rows: 3,
                        maxLength: 2000
                    })
                ])
            ]);
        }
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [h("h1", null, "\u041a\u043e\u0440\u0437\u0438\u043d\u0430")]),
            props.cart_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.cart_error),
            props.cart_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.cart_success),
            needsEmailVerification && h("div", { className: "react-panel", style: { borderColor: "#f0ad4e", color: "#8a6d3b" } }, [
                h("p", null, "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 email, \u0447\u0442\u043e\u0431\u044b \u043e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u0447\u0442\u0443 \u0438\u043b\u0438 \u0437\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043f\u0438\u0441\u044c\u043c\u043e \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e."),
                props.verification_link ? ButtonLink({ href: props.verification_link }, "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c email") : null,
                h("form", { action: "/verify-email/resend", method: "post", className: "react-inline-form", style: { marginTop: 12 }, onSubmit: handleSubmitOnce }, [
                    h("button", { className: "react-btn secondary", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e")
                ])
            ]),
            hasItems ? h("div", { className: "react-cart-layout" }, [
                h("section", { className: "react-cart-main" }, [h("div", { className: "react-cart-items" }, groups.map(group => {
                    const sellerName = group.seller_name || "\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446";
                    const groupItems = group.cart_items || [];
                    const groupShortage = Math.max(0, Number(group.shortage || 0));
                    return h("div", { key: `seller-${group.seller_id}`, className: "react-panel react-cart-seller-group" }, [h("div", { className: "react-cart-seller-row" }, [h("b", null, sellerName), h("span", { className: "react-muted" }, `${groupItems.length} \u043f\u043e\u0437.`), h("strong", null, money(Number(group.subtotal || 0)))]), groupShortage > 0 && h("span", { className: "react-cart-min-order-warning" }, `\u0414\u043e \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0437\u0430\u043a\u0430\u0437\u0430 \u0443 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430: ${money(groupShortage)}.`), h("div", { className: "react-cart-seller-items" }, groupItems.map(item => h(CartItemRow, { key: `${group.seller_id}-${item.id}`, item, sellerName })))]);
                }))]),
                h("aside", { className: "react-panel react-cart-summary" }, [
                    h("div", { className: "react-cart-summary-row" }, [h("span", null, "\u041a\u043e\u043b-\u0432\u043e \u0442\u043e\u0432\u0430\u0440\u043e\u0432"), h("b", null, totalCount)]),
                    h("div", { className: "react-cart-summary-row" }, [h("span", null, "\u0421\u0443\u043c\u043c\u0430 \u0442\u043e\u0432\u0430\u0440\u043e\u0432"), h("b", null, money(goodsTotal))]),
                    h("div", { className: "react-cart-summary-row" }, [h("span", null, "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"), h("b", null, money(deliveryTotal))]),
                    discountAmount > 0 && h("div", { className: "react-cart-summary-row react-cart-discount-row" }, [h("span", null, "\u0421\u043a\u0438\u0434\u043a\u0430"), h("b", null, `\u2212${money(discountAmount)}`)]),
                    h("div", { className: "react-cart-summary-row" }, [h("span", null, "\u0418\u0442\u043e\u0433"), h("b", null, money(grandTotal))]),
                    multipleSellers && h("p", { className: "react-muted react-cart-min-order" }, "\u0412 \u043a\u043e\u0440\u0437\u0438\u043d\u0435 \u0442\u043e\u0432\u0430\u0440\u044b \u0440\u0430\u0437\u043d\u044b\u0445 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u043e\u0432. \u041f\u0440\u0438 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0438 \u0441\u0438\u0441\u0442\u0435\u043c\u0430 \u0441\u043e\u0437\u0434\u0430\u0441\u0442 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0437\u0430\u043a\u0430\u0437 \u043f\u043e \u043a\u0430\u0436\u0434\u043e\u043c\u0443 \u0444\u0435\u0440\u043c\u0435\u0440\u0443, \u0441\u043f\u043e\u0441\u043e\u0431 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u044f \u0432\u044b\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e."),
                    h("form", { action: "/order/create", method: "post", className: "react-cart-checkout-form", onSubmit: handleCheckoutSubmit }, [
                        h("div", { className: "react-form-grid" }, [Field({ name: "full_name", placeholder: "\u0424\u0418\u041e \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044f", defaultValue: checkout.full_name || (user && user.full_name) || "", required: true, maxLength: 255 }), PhoneField({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: checkout.phone || (user && user.phone) || "", required: true }), h("input", { type: "hidden", name: "payment_method", value: paymentMethod }), h("div", { className: "wide react-stack" }, [h("label", { className: "react-muted" }, "\u0421\u043f\u043e\u0441\u043e\u0431 \u043e\u043f\u043b\u0430\u0442\u044b"), h("div", { className: "react-chip-row" }, [h("button", { type: "button", className: "react-chip react-chip-button active", onClick: () => setPaymentMethod("yookassa") }, "\u041e\u043d\u043b\u0430\u0439\u043d")])]), h("div", { className: "wide react-stack react-coupon-field" }, [h("label", { className: "react-muted" }, "\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434"), h("div", { className: "react-coupon-row" }, [h("input", { className: "react-input", name: "coupon_code", value: couponCode, onChange: event => { setCouponCode(event.target.value); setCouponPreview(null); setCouponError(""); }, placeholder: "\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434", maxLength: 50 }), h("button", { type: "button", className: "react-btn secondary", disabled: couponLoading || !(couponCode || "").trim(), onClick: applyCoupon }, couponLoading ? "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430\u2026" : "\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c")]), couponError && h("span", { className: "react-cart-min-order-warning" }, couponError), couponPreview && couponPreview.ok && h("span", { className: "react-muted" }, couponPreview.message || "")])]),
                        h("div", { className: "react-stack" }, activeGroups.map(deliveryBlock)),
                        minOrderText && h("p", { className: "react-muted react-cart-min-order" }, minOrderText),
                        hasMinOrderErrors && h("span", { className: "react-cart-min-order-warning" }, minOrderMessage),
                        h("p", { className: "react-muted" }, "\u0417\u0430\u043a\u0430\u0437 \u0431\u0443\u0434\u0435\u0442 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e\u0441\u043b\u0435 \u0443\u0441\u043f\u0435\u0448\u043d\u043e\u0439 \u043e\u043f\u043b\u0430\u0442\u044b."),
                        h("button", { className: `react-btn react-cart-submit ${hasMinOrderErrors || hasUnavailableDelivery || needsEmailVerification ? "is-disabled" : ""}`, type: "submit", disabled: hasMinOrderErrors || hasUnavailableDelivery || needsEmailVerification }, "\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u043e\u043f\u043b\u0430\u0442\u0435")
                    ]),
                    h("div", { className: "react-cart-clear-wrap" }, [PostButton({ action: "/cart/clear", children: "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043a\u043e\u0440\u0437\u0438\u043d\u0443", className: "react-btn secondary", confirmMessage: "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043a\u043e\u0440\u0437\u0438\u043d\u0443?" })])
                ])
            ]) : h("div", { className: "react-empty react-panel" }, [h("p", null, "\u041a\u043e\u0440\u0437\u0438\u043d\u0430 \u043f\u0443\u0441\u0442\u0430\u044f."), ButtonLink({ href: "/catalog" }, "\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u043a\u0430\u0442\u0430\u043b\u043e\u0433")]),
            h(NoticeDialog, { open: minOrderNoticeOpen, title: "\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430 \u0437\u0430\u043a\u0430\u0437\u0430", text: minOrderMessage, onClose: () => setMinOrderNoticeOpen(false) })
        ]);
    }
    function promoStatusText(promo) {
        if (!promo || !promo.is_active) return "\u041d\u0435\u0430\u043a\u0442\u0438\u0432\u0435\u043d";
        const now = Date.now();
        if (promo.valid_to && new Date(promo.valid_to).getTime() < now) return "\u0418\u0441\u0442\u0451\u043a";
        if (promo.valid_from && new Date(promo.valid_from).getTime() > now) return "\u0421\u043a\u043e\u0440\u043e";
        if (promo.max_uses && Number(promo.usage_count || 0) >= Number(promo.max_uses)) return "\u0418\u0441\u0447\u0435\u0440\u043f\u0430\u043d";
        return "\u0410\u043a\u0442\u0438\u0432\u0435\u043d";
    }
    function SellerPage() {
        const financials = props.financials || {};
        const products = props.products || [];
        const seller = props.seller || {};
        const certificates = props.certificates || [];
        const promoCodes = props.promo_codes || [];
        const accountUser = props.user || seller;
        const isFarmerAccount = accountUser.role === "seller";
        const promoToday = new Date();
        const promoDefaultFrom = promoToday.toISOString().slice(0, 10);
        const promoDefaultTo = new Date(promoToday.getFullYear(), promoToday.getMonth(), promoToday.getDate() + 30).toISOString().slice(0, 10);
        const [tab, setTab] = React.useState(props.initial_tab || (page === "seller_settings" ? "profile" : "overview"));
        const [productFilter, setProductFilter] = React.useState("all");
        const activeProducts = products.filter(product => product.status === "approved");
        const pendingProducts = products.filter(product => product.status === "pending");
        const lowStockProducts = products.filter(product => stockStatus(product) === "low");
        const outOfStockProducts = products.filter(product => stockStatus(product) === "out");
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
            { id: "delivery", label: "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430" },
            { id: "products", label: "\u0422\u043e\u0432\u0430\u0440\u044b" },
            ...(isFarmerAccount ? [{ id: "promocodes", label: "\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u044b" }] : []),
            { id: "add", label: "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c" },
            ...(isFarmerAccount ? [
                { id: "finance", label: "\u041c\u043e\u0439 \u0431\u0430\u043b\u0430\u043d\u0441" },
                { id: "history", label: "\u0418\u0441\u0442\u043e\u0440\u0438\u044f" }
            ] : [{ id: "finance", label: "\u0424\u0438\u043d\u0430\u043d\u0441\u044b" }])
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
            if (item.id === "finance" || item.id === "history") {
                return A({
                    key: item.id,
                    href: `/seller/?tab=${item.id}`,
                    className: `react-btn ${tab === item.id ? "" : "secondary"}`
                }, item.label);
            }
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
                        PhoneField({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: seller.phone || "" }),
                        Field({ name: "farm_address", placeholder: "\u0420\u0435\u0433\u0438\u043e\u043d / \u0430\u0434\u0440\u0435\u0441", defaultValue: seller.farm_address || "", className: "wide", maxLength: 500 }),
                        Textarea({ name: "product_categories", placeholder: "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u0438", defaultValue: seller.product_categories || "", className: "wide", rows: 3, maxLength: 1000 }),
                        Textarea({ name: "farm_description", placeholder: "\u041e \u0441\u0435\u0431\u0435 \u0438 \u0444\u0435\u0440\u043c\u0435", defaultValue: seller.farm_description || "", className: "wide", maxLength: 2000 }),
                        h("div", { className: "wide" }, [
                            h("label", { className: "react-muted" }, "\u0424\u043e\u0442\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u044f"),
                            seller.farm_photo_url ? h("img", { src: seller.farm_photo_url, alt: "\u0424\u0435\u0440\u043c\u0430", className: "react-passport-preview" }) : null,
                            h("input", { name: "farm_photo", type: "file", className: "react-input wide", accept: "image/*" })
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
            tab === "delivery" && h("section", { className: "react-panel react-stack" }, [
                h("div", { className: "react-page-title" }, [h("h2", null, "Настройки доставки")]),
                h("form", { action: "/seller/delivery/settings", method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                    h("div", { className: "react-info-grid" }, [
                        h("div", { className: "react-card react-stack" }, [
                            h("h3", null, "Самовывоз"),
                            h("label", { className: "react-checkbox-row" }, [h("input", { type: "checkbox", name: "pickup_enabled", value: "1", defaultChecked: Number(seller.pickup_enabled == null ? 1 : seller.pickup_enabled) === 1 }), h("span", null, "Включить самовывоз")]),
                            Field({ name: "pickup_address", placeholder: "Адрес самовывоза", defaultValue: seller.pickup_address || seller.farm_address || "", maxLength: 500 }),
                            Textarea({ name: "pickup_comment", placeholder: "Комментарий для покупателя", defaultValue: seller.pickup_comment || "", rows: 3, maxLength: 1000 })
                        ]),
                        h("div", { className: "react-card react-stack" }, [
                            h("h3", null, "Доставка силами фермера"),
                            h("label", { className: "react-checkbox-row" }, [h("input", { type: "checkbox", name: "farmer_delivery_enabled", value: "1", defaultChecked: Number(seller.farmer_delivery_enabled == null ? 1 : seller.farmer_delivery_enabled) === 1 }), h("span", null, "Включить доставку фермером")]),
                            Field({ name: "farmer_delivery_fee", type: "number", min: "0", step: "1", placeholder: "Стоимость доставки", defaultValue: seller.farmer_delivery_fee || 0 }),
                            Field({ name: "farmer_delivery_min_order", type: "number", min: "0", step: "1", placeholder: "Минимальная сумма заказа для доставки", defaultValue: seller.farmer_delivery_min_order || 0 }),
                            Textarea({ name: "farmer_delivery_comment", placeholder: "Районы доставки / комментарий", defaultValue: seller.farmer_delivery_comment || "", rows: 3, maxLength: 1000 }),
                            h("div", { className: "react-stack" }, [
                                h("label", { className: "react-muted" }, "Доступные временные слоты"),
                                h("label", { className: "react-checkbox-row" }, [h("input", { type: "checkbox", name: "delivery_slots", value: "10-14", defaultChecked: !seller.delivery_slots || String(seller.delivery_slots).includes("10-14") }), h("span", null, "10:00 - 14:00")]),
                                h("label", { className: "react-checkbox-row" }, [h("input", { type: "checkbox", name: "delivery_slots", value: "14-18", defaultChecked: !seller.delivery_slots || String(seller.delivery_slots).includes("14-18") }), h("span", null, "14:00 - 18:00")]),
                                h("label", { className: "react-checkbox-row" }, [h("input", { type: "checkbox", name: "delivery_slots", value: "18-22", defaultChecked: !seller.delivery_slots || String(seller.delivery_slots).includes("18-22") }), h("span", null, "18:00 - 22:00")])
                            ])
                        ]),
                        h("div", { className: "react-card react-stack" }, [
                            h("h3", null, "СДЭК"),
                            h("label", { className: "react-checkbox-row" }, [h("input", { type: "checkbox", name: "partner_delivery_enabled", value: "1", defaultChecked: Number(seller.partner_delivery_enabled || 0) === 1 }), h("span", null, "Предлагать СДЭК покупателям")]),
                            Field({ name: "partner_delivery_fee", type: "number", min: "0", step: "1", placeholder: "Стоимость СДЭК", defaultValue: seller.partner_delivery_fee || 700 }),
                            Textarea({ name: "partner_delivery_comment", placeholder: "Комментарий к СДЭК для покупателя", defaultValue: seller.partner_delivery_comment || "", rows: 3, maxLength: 1000 }),
                            h("p", { className: "react-muted" }, "Если включено, покупатель увидит СДЭК в корзине у товаров этого фермера. Стоимость будет рассчитана через API СДЭК.")
                        ])
                    ]),
                    h("button", { className: "react-btn", type: "submit" }, "Сохранить настройки доставки")
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
            tab === "promocodes" && isFarmerAccount && h(React.Fragment, null, [
                h("section", { className: "react-panel react-stack" }, [
                    h("div", { className: "react-page-title" }, [h("h2", null, "\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434")]),
                    h("form", { action: "/seller/promo-codes/create", method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                        Field({ name: "code", placeholder: "\u041a\u043e\u0434 (\u043d\u0430\u043f\u0440\u0438\u043c\u0435\u0440 FRESH10)", required: true, maxLength: 50 }),
                        Field({ name: "title", placeholder: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0434\u043b\u044f \u0441\u0435\u0431\u044f (\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e)", maxLength: 255 }),
                        Field({ name: "discount_percent", type: "number", min: "5", max: "50", step: "1", placeholder: "\u0421\u043a\u0438\u0434\u043a\u0430, %", defaultValue: 10, required: true }),
                        Field({ name: "min_order", type: "number", min: "0", step: "1", placeholder: "\u041c\u0438\u043d. \u0441\u0443\u043c\u043c\u0430 \u043f\u043e \u0432\u0430\u0448\u0438\u043c \u0442\u043e\u0432\u0430\u0440\u0430\u043c", defaultValue: 0 }),
                        Field({ name: "valid_from", type: "date", defaultValue: promoDefaultFrom, required: true }),
                        Field({ name: "valid_to", type: "date", defaultValue: promoDefaultTo, min: promoDefaultFrom, required: true }),
                        Field({ name: "max_uses", type: "number", min: "1", step: "1", placeholder: "\u041b\u0438\u043c\u0438\u0442 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0439 (\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e)" }),
                        h("button", { className: "react-btn wide", type: "submit" }, "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434")
                    ]),
                    h("p", { className: "react-muted" }, "\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 \u0442\u043e\u0432\u0430\u0440\u044b \u0432\u0430\u0448\u0435\u0439 \u0444\u0435\u0440\u043c\u044b. \u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c \u0443\u0432\u0438\u0434\u0438\u0442 \u0441\u043a\u0438\u0434\u043a\u0443 \u0432 \u043a\u043e\u0440\u0437\u0438\u043d\u0435 \u043f\u043e\u0441\u043b\u0435 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u043a\u043e\u0434\u0430.")
                ]),
                h("section", { className: "react-panel" }, [
                    h("div", { className: "react-page-title" }, [h("h2", null, "\u041c\u043e\u0438 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u044b")]),
                    promoCodes.length
                        ? h("table", { className: "react-table" }, h("tbody", null, promoCodes.map(promo => h("tr", { key: promo.id }, [
                            h("td", null, [h("b", null, promo.code), promo.title ? h("p", { className: "react-muted" }, promo.title) : null]),
                            h("td", null, `${promo.discount_percent}%`),
                            h("td", null, promo.min_order ? money(promo.min_order) : "\u2014"),
                            h("td", null, `${dateText(promo.valid_from) || "\u2014"} \u2014 ${dateText(promo.valid_to) || "\u2014"}`),
                            h("td", null, promo.max_uses ? `${promo.usage_count || 0} / ${promo.max_uses}` : String(promo.usage_count || 0)),
                            h("td", null, h("span", { className: "react-chip" }, promoStatusText(promo))),
                            h("td", null, PostButton({ action: `/seller/promo-codes/${promo.id}/toggle`, className: "react-btn secondary", children: promo.is_active ? "\u0412\u044b\u043a\u043b\u044e\u0447\u0438\u0442\u044c" : "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c" }))
                        ]))))
                        : h("div", { className: "react-empty" }, "\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
                ])
            ]),
            tab === "finance" && isFarmerAccount && h(React.Fragment, null, [
                h("div", { className: "react-stat-grid" }, [
                    h("div", { className: "react-card" }, [h("h2", null, money(financials.pending_payout)), h("p", null, "\u0412 \u0443\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0438 (\u044d\u0441\u043a\u0440\u043e\u0443)")]),
                    h("div", { className: "react-card" }, [h("h2", null, financials.paid_orders_count || 0), h("p", null, "\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b")]),
                    h("div", { className: "react-card" }, [h("h2", null, money(financials.platform_fee)), h("p", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b")])
                ]),
                h(WalletPage, { embedded: true })
            ]),
            tab === "history" && isFarmerAccount && h(TransactionsPage, { embedded: true })
        ]);
    }
    function ProductForm({ action, product, admin }) {
        product = product || {};
        const initialCategory = product.category || "\u0414\u0440\u0443\u0433\u043e\u0435";
        const [category, setCategory] = React.useState(initialCategory);
        const unitOptions = unitsForProductCategory(category);
        const [unit, setUnit] = React.useState(() => {
            const current = stockUnit(product);
            return unitOptions.includes(current) ? current : unitOptions[0];
        });
        React.useEffect(() => {
            const options = unitsForProductCategory(category);
            setUnit(prev => (options.includes(prev) ? prev : options[0]));
        }, [category]);
        return h("form", { action, method: "post", encType: "multipart/form-data", className: "react-panel react-form-grid", onSubmit: handleSubmitOnce }, [
            Field({ name: "name", placeholder: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", defaultValue: product.name, required: true, maxLength: 255 }),
            Field({ name: "price", type: "number", step: "0.01", min: "0.01", placeholder: "\u0426\u0435\u043d\u0430", defaultValue: product.price, required: true }),
            Field({ name: "discount_price", type: "number", step: "0.01", min: "0", placeholder: "\u0426\u0435\u043d\u0430 \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439", defaultValue: product.discount_price || "", max: product.price || undefined }),
            Select({ name: "category", value: category, onChange: event => setCategory(event.target.value) }, PRODUCT_CATEGORIES.map(item => h("option", { key: item, value: item }, item))),
            Field({ name: "region", placeholder: "\u0420\u0435\u0433\u0438\u043e\u043d", defaultValue: product.region, maxLength: 200 }),
            Field({ name: "variety", placeholder: "\u0421\u043e\u0440\u0442", defaultValue: product.variety, maxLength: 100 }),
            Field({ name: "weight_per_unit", placeholder: "\u0424\u0430\u0441\u043e\u0432\u043a\u0430 (\u043d\u0430\u043f\u0440. 1 \u043a\u0433, 10 \u0448\u0442)", defaultValue: product.weight_per_unit, maxLength: 50 }),
            Field({ name: "expiration_days", type: "number", min: "0", step: "1", placeholder: "\u0421\u0440\u043e\u043a \u0433\u043e\u0434\u043d\u043e\u0441\u0442\u0438, \u0434\u043d\u0435\u0439", defaultValue: product.expiration_days || 0 }),
            Field({ name: "stock", type: "number", min: "0", step: "1", placeholder: "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438", defaultValue: stockQuantity(product) }),
            Select({ name: "unit", value: unit, onChange: event => setUnit(event.target.value) }, unitOptions.map(item => h("option", { key: item, value: item }, item))),
            Field({ name: "low_stock_threshold", type: "number", min: "0", step: "1", placeholder: "\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u043e\u0441\u0442\u0430\u0442\u043e\u043a", defaultValue: product.low_stock_threshold || 0 }),
            h("input", { type: "hidden", name: "has_certificate", value: "1" }),
            admin && Field({ name: "owner_id", type: "number", min: "0", step: "1", placeholder: "ID \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430", defaultValue: product.owner_id || 0 }),
            Textarea({ name: "description", placeholder: "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435", defaultValue: product.description, className: "wide", maxLength: 4000 }),
            h("label", { key: "photos", className: "wide react-stack" }, [
                h("span", { className: "react-muted" }, "\u0424\u043e\u0442\u043e \u0442\u043e\u0432\u0430\u0440\u0430"),
                h("input", { name: "image", type: "file", className: "react-input wide", accept: "image/*" }),
                h("input", { name: "images", type: "file", className: "react-input wide", accept: "image/*", multiple: true }),
                (product.image_urls || []).length > 1
                    ? h("span", { className: "react-muted" }, `\u0421\u0435\u0439\u0447\u0430\u0441 ${(product.image_urls || []).length} \u0444\u043e\u0442\u043e. \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043d\u043e\u0432\u044b\u0435, \u0447\u0442\u043e\u0431\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a \u0433\u0430\u043b\u0435\u0440\u0435\u0435.`)
                    : h("span", { className: "react-muted" }, "\u041c\u043e\u0436\u043d\u043e \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0444\u0430\u0439\u043b\u043e\u0432 \u2014 \u043f\u0435\u0440\u0432\u043e\u0435 \u0444\u043e\u0442\u043e \u0431\u0443\u0434\u0435\u0442 \u0433\u043b\u0430\u0432\u043d\u044b\u043c.")
            ]),
            h("button", { className: "react-btn wide", type: "submit" }, product.id ? "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c" : "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440")
        ]);
    }
    function ProductTable({ products, seller }) {
        return h("section", { className: "react-panel" }, [
            h("h2", null, "\u0422\u043e\u0432\u0430\u0440\u044b"),
            h("table", { className: "react-table" }, h("tbody", null, (products || []).map(p => {
                const status = stockStatus(p);
                const productHref = `/product/${p.id}`;
                const rowProps = interactiveRowProps(productHref);
                rowProps.key = p.id;
                rowProps.className = `${rowProps.className} stock-row stock-${status}`;
                return h("tr", rowProps, [
                h("td", null, A({ href: `/product/${p.id}` }, p.name)),
                    h("td", null, h(PriceDisplay, { product: p, compact: true, inline: true })),
                h("td", null, p.category),
                    h("td", null, h("span", { className: `react-stock-pill stock-${status}` }, stockText(p))),
                    h("td", null, productStatusText(p.status)),
                h("td", null, h("div", { className: "react-actions" }, [
                        ButtonLink({ href: productHref, className: "secondary" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c"),
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
                    (seller.farm_address || sellerPickupAddress(seller)) && h("div", { className: "react-chip-row" }, [
                        sellerPickupAddress(seller) ? h("span", { className: "react-chip" }, `\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437: ${sellerPickupAddress(seller)}`) : null,
                        seller.farm_address && h("span", { className: "react-chip" }, seller.farm_address),
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
                        h("div", { className: "react-review-stars", "aria-label": `\u041e\u0446\u0435\u043d\u043a\u0430 ${r.rating || 0} \u0438\u0437 5` }, renderStars(r.rating || 0)),
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
    function OrdersPage(options = {}) {
        const orderList = options.limit ? (props.orders || []).slice(0, options.limit) : (props.orders || []);
        return h(React.Fragment, null, [
            options.showTitle === false ? null : h("div", { className: "react-page-title" }, h("h1", null, "\u041c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b")),
            options.hideMessages ? null : props.order_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.order_success),
            options.hideMessages ? null : props.payment_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.payment_success),
            options.hideMessages ? null : props.payment_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.payment_error),
            orderList.length ? orderList.map(order => {
                const items = order.items || [];
                const goodsTotal = items.reduce((sum, item) => sum + (item.product ? productFinalPrice(item.product) * Number(item.quantity || 0) : 0), 0);
                const discount = Number(order.discount_amount || 0);
                const deliveryPrice = deliveryPriceValue(order);
                const delivery = order.delivery || {};
                const trackNumber = order.track_number || delivery.track_number;
                const trackingUrl = delivery.tracking_url || (trackNumber ? `/delivery/track/${trackNumber}` : "");
                const deliveryProvider = delivery.provider_name || delivery.provider || "";
                return h("section", { key: order.id, id: `order-${order.id}`, className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [
                    h("div", null, [h("h2", null, `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(order)}`), h("p", { className: "react-muted" }, dateText(order.created_at))]),
                    h("strong", null, h(PriceDisplay, { product: { price: order.total_price }, compact: true, inline: true }))
                ]),
                h(OrderCancelStatusBlock, { order, statusLabels: props.status_labels }),
                h("div", { className: "react-chip-row" }, [
                    h("span", { className: `react-chip react-status-chip status-${order.status || "created"}` }, orderStatusText(order, props.status_labels)),
                    h("span", { className: `react-chip react-status-chip payment-${order.payment_status || "pending"}` }, `\u041e\u043f\u043b\u0430\u0442\u0430: ${paymentStatusText(order.payment_status)}`),
                    h("span", { className: `react-chip react-status-chip delivery-${order.status || "created"}` }, `\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430: ${deliveryStatusText(order)}`)
                ]),
                h("div", { className: "react-info-grid react-order-meta-grid" }, [
                    h("div", { className: "react-card" }, [h("b", null, "\u041f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044c"), h("p", null, order.customer_name || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"), h("p", { className: "react-muted" }, order.customer_phone || "")]),
                    h("div", { className: "react-card" }, [
                        h("b", null, (order.delivery_method || "") === "pickup" ? "\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437" : "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"),
                        h("p", null, deliveryMethodText(order.delivery_method) || "\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430"),
                        (order.delivery_method || "") === "pickup"
                            ? h(PickupAddressBlock, { address: orderPickupAddress(order) || "\u0410\u0434\u0440\u0435\u0441 \u0443\u0442\u043e\u0447\u043d\u044f\u0435\u0442 \u043f\u0440\u043e\u0434\u0430\u0432\u0435\u0446" })
                            : h("p", { className: "react-muted" }, order.delivery_address || "-"),
                        order.delivery_slot ? h("p", { className: "react-muted" }, order.delivery_slot) : null,
                        trackNumber ? h("p", { className: "react-muted" }, `\u0422\u0440\u0435\u043a-\u043d\u043e\u043c\u0435\u0440: ${trackNumber}`) : null
                    ]),
                    (deliveryProvider || trackNumber) ? h("div", { className: "react-card react-logistics-card" }, [
                        h("b", null, "Логистика"),
                        h(CdekDeliveryBadge, { method: order.delivery_method, provider: deliveryProvider, trackNumber }),
                        h("p", null, deliveryProvider || "Служба доставки"),
                        trackNumber ? h("p", { className: "react-track-number" }, `Трек: ${trackNumber}`) : null,
                        trackNumber ? ButtonLink({ href: trackingUrl, className: "secondary" }, "Отследить") : null
                    ]) : null,
                    h("div", { className: "react-card" }, [h("b", null, "\u041e\u043f\u043b\u0430\u0442\u0430"), h("p", null, paymentMethodText(order.selected_payment_method) || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"), h("p", { className: "react-muted" }, paymentStatusText(order.payment_status)), order.customer_comment ? h("p", { className: "react-muted" }, order.customer_comment) : null]),
                    h("div", { className: "react-card" }, [h("b", null, "\u0421\u0443\u043c\u043c\u044b"), h("p", null, `\u0422\u043e\u0432\u0430\u0440\u044b: ${money(goodsTotal)}`), discount > 0 ? h("p", { className: "react-muted" }, `\u0421\u043a\u0438\u0434\u043a\u0430: -${money(discount)}`) : null, h("p", { className: "react-muted" }, `\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430: ${money(deliveryPrice)}`), h("p", { className: "react-price" }, `\u0418\u0442\u043e\u0433: ${money(order.total_price)}`)])
                ]),
                h("table", { className: "react-table" }, h("tbody", null, items.map(item => h("tr", { key: item.id }, [h("td", null, item.product ? h(ProductMiniPreview, { product: item.product }) : "\u0422\u043e\u0432\u0430\u0440"), h("td", null, item.quantity), h("td", null, item.product ? h(PriceDisplay, { product: item.product, compact: true, inline: true }) : ""), h("td", null, item.product ? money(productFinalPrice(item.product) * Number(item.quantity || 0)) : "")])))),
                h("div", { className: "react-actions" }, [
                    isOrderPayable(order) && order.selected_payment_method === "yookassa" && ButtonLink({ href: `/payment/${order.id}` }, "\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c"),
                    h(UserOrderCancelForm, { order }),
                    isOrderReceivable(order) && PostButton({ action: `/order/${order.id}/complete`, children: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u0430", confirmMessage: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c, \u0447\u0442\u043e \u0442\u043e\u0432\u0430\u0440 \u043f\u043e\u043b\u0443\u0447\u0435\u043d? \u0421\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0431\u0443\u0434\u0443\u0442 \u043f\u0435\u0440\u0435\u0432\u0435\u0434\u0435\u043d\u044b \u0444\u0435\u0440\u043c\u0435\u0440\u0443." }),
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
            }) : h("div", { className: "react-empty react-panel" }, options.emptyText || "\u0417\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    function ProfilePage() {
        const orders = props.orders || [];
        const activeOrders = orders.filter(order => !["completed", "cancelled", "canceled", "refunded"].includes(order.status || "")).length;
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, h("h1", null, "\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442")),
            props.profile_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.profile_error),
            props.profile_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.profile_success),
            h("section", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u0417\u0430\u043a\u0430\u0437\u044b"), h("p", null, orders.length), h("p", { className: "react-muted" }, "\u0412\u0441\u0435\u0433\u043e")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435"), h("p", null, activeOrders), h("p", { className: "react-muted" }, "\u0416\u0434\u0443\u0442 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439")]),
                h("div", { className: "react-card" }, [h("b", null, "\u041a\u043e\u043d\u0442\u0430\u043a\u0442"), h("p", null, user && (user.full_name || user.email) || "-"), h("p", { className: "react-muted" }, user && user.phone || "\u0422\u0435\u043b\u0435\u0444\u043e\u043d \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d")])
            ]),
            h("section", { className: "react-panel" }, [
                h("h2", null, "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b"),
                h("form", { action: "/profile/update", method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Field({ name: "full_name", placeholder: "\u0418\u043c\u044f", defaultValue: user && user.full_name || "", maxLength: 255 }),
                    PhoneField({ name: "phone", placeholder: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d", defaultValue: user && user.phone || "", required: true }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c")
                ])
            ]),
            h("div", { className: "react-actions", style: { marginTop: 16 } }, [
                ButtonLink({ href: "/order/orders", className: "secondary" }, "\u0412\u0441\u0435 \u0437\u0430\u043a\u0430\u0437\u044b"),
                ButtonLink({ href: "/complaints/my", className: "secondary" }, "\u041c\u043e\u0438 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f"),
                ButtonLink({ href: "/conversations/", className: "secondary" }, "\u041c\u043e\u0438 \u0447\u0430\u0442\u044b")
            ]),
            h("section", { className: "react-stack", style: { marginTop: 20 } }, [
                h("div", { className: "react-page-title" }, [
                    h("h2", null, "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0437\u0430\u043a\u0430\u0437\u044b"),
                    orders.length > 3 ? ButtonLink({ href: "/order/orders", className: "secondary" }, "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435") : null
                ]),
                h(OrdersPage, { limit: 3, showTitle: false, hideMessages: true })
            ])
        ]);
    }
    function SellerStatusActions(order) {
        const status = order.status || "created";
        const method = order.delivery_method || "pickup";
        const paid = (order.payment_status || "pending") === "paid";
        const actions = [];
        if (!paid && ["created", "awaiting_payment", "payment_failed"].includes(status)) {
            actions.push({ action: "cancel", label: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437?" });
        } else if (["paid", "confirmed"].includes(status)) {
            actions.push({ action: "assemble", label: "\u041d\u0430\u0447\u0430\u0442\u044c \u0441\u0431\u043e\u0440\u043a\u0443", className: "react-btn" });
            actions.push({ action: "cancel", label: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437?" });
        } else if (status === "assembling") {
            if (method === "pickup") actions.push({ action: "ready_pickup", label: "\u0413\u043e\u0442\u043e\u0432 \u043a \u0432\u044b\u0434\u0430\u0447\u0435", className: "react-btn" });
            else if (method === "partner_delivery") actions.push({ action: "transfer_partner", label: "\u041f\u0435\u0440\u0435\u0434\u0430\u0442\u044c \u0432 \u0421\u0414\u042d\u041a", className: "react-btn" });
            else actions.push({ action: "ready_delivery", label: "\u0413\u043e\u0442\u043e\u0432 \u043a \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435", className: "react-btn" });
            actions.push({ action: "cancel", label: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437?" });
        } else if (status === "ready_for_pickup") {
            actions.push({ action: "delivered", label: "\u0412\u044b\u0434\u0430\u043d \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044e", className: "react-btn" });
        } else if (status === "ready_for_delivery") {
            actions.push({ action: "in_delivery", label: method === "partner_delivery" ? "\u0412 \u043f\u0443\u0442\u0438" : "\u0412 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435", className: "react-btn" });
            if (method === "farmer_delivery") actions.push({ action: "delivered", label: "\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d", className: "react-btn secondary" });
        } else if (status === "in_delivery") {
            actions.push({ action: "delivered", label: "\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d", className: "react-btn" });
        }
        if (!actions.length) return !paid && status === "awaiting_payment" ? h("p", { className: "react-muted" }, "\u0417\u0430\u043a\u0430\u0437 \u043e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b. \u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430 \u0431\u0443\u0434\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u043f\u043e\u0441\u043b\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u043f\u043b\u0430\u0442\u0435\u0436\u0430.") : null;
        return h("div", { className: "react-stack" }, [
            !paid && status === "awaiting_payment" ? h("p", { className: "react-muted" }, "\u0417\u0430\u043a\u0430\u0437 \u043e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b. \u041d\u0430\u0447\u0430\u0442\u044c \u0441\u0431\u043e\u0440\u043a\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435\u043b\u044c\u0437\u044f.") : null,
            actions.some(item => item.action === "cancel") && h(OrderCancelForm, {
                key: "cancel-form",
                action: `/seller/orders/${order.id}/status`,
                className: "react-panel react-stack",
                hiddenFields: [h("input", { type: "hidden", name: "action", value: "cancel" })],
                confirmText: paid
                    ? "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437? \u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c \u043f\u043e\u043b\u0443\u0447\u0438\u0442 \u0432\u043e\u0437\u0432\u0440\u0430\u0442 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443."
                    : "\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u044d\u0442\u043e\u0442 \u0437\u0430\u043a\u0430\u0437?",
                hint: paid ? "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c \u043f\u043e\u043b\u0443\u0447\u0438\u0442 \u0432\u043e\u0437\u0432\u0440\u0430\u0442 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443." : null,
                reasonRequired: true,
                reasonPlaceholder: "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043c\u0435\u043d\u044b \u0434\u043b\u044f \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044f"
            }),
            h("div", { key: "actions", className: "react-actions" }, actions.filter(item => item.action !== "cancel").map(item => h("form", { key: item.action, action: `/seller/orders/${order.id}/status`, method: "post", className: "react-inline-form", onSubmit: item.confirmMessage ? confirmSubmit(item.confirmMessage) : handleSubmitOnce }, [h("input", { type: "hidden", name: "action", value: item.action }), h("button", { type: "submit", className: item.className }, item.label)])))
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
            { id: "awaiting_payment", label: "\u041e\u0436\u0438\u0434\u0430\u044e\u0442 \u043e\u043f\u043b\u0430\u0442\u044b" },
            { id: "confirmed", label: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043d\u044b\u0435" },
            { id: "assembling", label: "\u0421\u0431\u043e\u0440\u043a\u0430" },
            { id: "ready_for_pickup", label: "\u0413\u043e\u0442\u043e\u0432\u044b \u043a \u0432\u044b\u0434\u0430\u0447\u0435" },
            { id: "ready_for_delivery", label: "\u0413\u043e\u0442\u043e\u0432\u044b \u043a \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435" },
            { id: "in_delivery", label: "\u0412 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435" },
            { id: "cancelled", label: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0435" }
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
                h("div", { className: "react-card" }, [h("h2", null, counts.awaiting_payment || counts.created || 0), h("p", null, "\u041e\u0436\u0438\u0434\u0430\u044e\u0442 \u043e\u043f\u043b\u0430\u0442\u044b")]),
                h("div", { className: "react-card" }, [h("h2", null, counts.assembling || 0), h("p", null, "\u0421\u043e\u0431\u0438\u0440\u0430\u044e\u0442\u0441\u044f")]),
                h("div", { className: "react-card" }, [h("h2", null, (counts.ready_for_delivery || 0) + (counts.in_delivery || 0)), h("p", null, "\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u044e\u0442\u0441\u044f")])
            ]),
            h("div", { className: "react-tab-row" }, filters.map(item => h("button", {
                key: item.id,
                type: "button",
                className: `react-btn ${statusFilter === item.id ? "" : "secondary"}`,
                onClick: () => setStatusFilter(item.id)
            }, item.label))),
            filteredOrders.length ? filteredOrders.map(order => {
                const discount = Number(order.discount_amount || 0);
                const deliveryPrice = Number(order.delivery_fee || 0);
                const goodsTotal = Number(order.seller_total || 0);
                return h("section", { key: order.id, id: `order-${order.id}`, className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [
                    h("h2", null, `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(order)}`),
                    h("strong", null, money(order.total_price != null ? order.total_price : goodsTotal + deliveryPrice - discount))
                ]),
                h(OrderCancelStatusBlock, { order, statusLabels: props.status_labels }),
                h("div", { className: "react-chip-row" }, [
                    h("span", { className: `react-chip react-status-chip status-${order.status || "created"}` }, (props.status_labels && props.status_labels[order.status]) || order.status || "created"),
                    h("span", { className: `react-chip react-status-chip payment-${order.payment_status || "pending"}` }, `\u041e\u043f\u043b\u0430\u0442\u0430: ${paymentStatusText(order.payment_status)}`)
                ]),
                h("div", { className: "react-info-grid react-order-meta-grid" }, [
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c"),
                        h("p", null, order.customer_name || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"),
                        h("p", { className: "react-muted" }, order.customer_phone || "")
                    ]),
                    h("div", { className: "react-card" }, [
                        h("b", null, (order.delivery_method || "") === "pickup" ? "\u0421\u0430\u043c\u043e\u0432\u044b\u0432\u043e\u0437" : "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"),
                        h("p", null, deliveryMethodText(order.delivery_method) || "\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430"),
                        (order.delivery_method || "") === "pickup"
                            ? h(PickupAddressBlock, { address: orderPickupAddress(order) || "\u0410\u0434\u0440\u0435\u0441 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d" })
                            : h("p", { className: "react-muted" }, order.delivery_address || "-"),
                        order.delivery_slot ? h("p", { className: "react-muted" }, order.delivery_slot) : null,
                        h(CdekDeliveryBadge, { method: order.delivery_method, provider: order.delivery_provider, trackNumber: order.delivery_track_number }),
                        order.delivery_provider ? h("p", { className: "react-muted" }, `Логистика: ${order.delivery_provider}`) : null,
                        order.delivery_track_number ? h("p", { className: "react-track-number" }, `Трек: ${order.delivery_track_number}`) : null,
                        order.delivery_track_number ? ButtonLink({ href: order.delivery_tracking_url || `/delivery/track/${order.delivery_track_number}`, className: "secondary" }, "Отследить") : null
                    ]),
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u041e\u043f\u043b\u0430\u0442\u0430"),
                        h("p", null, paymentMethodText(order.selected_payment_method) || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"),
                        order.customer_comment ? h("p", { className: "react-muted" }, order.customer_comment) : null
                    ]),
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u0421\u0443\u043c\u043c\u044b"),
                        h("p", null, `\u0422\u043e\u0432\u0430\u0440\u044b: ${money(goodsTotal)}`),
                        discount > 0 ? h("p", { className: "react-muted" }, `\u0421\u043a\u0438\u0434\u043a\u0430: -${money(discount)}`) : null,
                        h("p", { className: "react-muted" }, `\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430: ${money(deliveryPrice)}`),
                        h("p", { className: "react-price" }, `\u0418\u0442\u043e\u0433: ${money(order.total_price != null ? order.total_price : goodsTotal + deliveryPrice - discount)}`)
                    ])
                ]),
                h("table", { className: "react-table" }, h("tbody", null, (order.items || []).map(item => h("tr", { key: item.id }, [
                    h("td", null, item.product ? h(ProductMiniPreview, { product: item.product }) : "\u0422\u043e\u0432\u0430\u0440"),
                    h("td", null, item.quantity),
                    h("td", null, item.product ? h(PriceDisplay, { product: item.product, compact: true, inline: true }) : ""),
                    h("td", null, money(item.item_total != null ? item.item_total : (item.product ? productFinalPrice(item.product) * Number(item.quantity || 0) : 0))),
                    h("td", null, h(OrderItemExcludeAction, { order, item, role: "seller" }))
                ])))),
                h("div", { className: "react-actions" }, [
                    ButtonLink({ href: `/conversations/order/${order.id}`, className: "secondary" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u043f\u043e \u0437\u0430\u043a\u0430\u0437\u0443")
                ]),
                h(OrderSettlementBlock, { settlement: order.settlement }),
                h(SellerStatusActions, order)
            ]);
            }) : h("div", { className: "react-empty react-panel" }, "\u0417\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c\u0443 \u0441\u0442\u0430\u0442\u0443\u0441\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
        ]);
    }
    function WalletPage({ embedded }) {
        const summary = props.wallet_summary || {};
        const available = summary.available_balance != null ? summary.available_balance : (props.wallet && props.wallet.balance);
        const ledger = props.ledger_entries || [];
        const canWithdraw = Number(available || 0) > 0;
        return h(React.Fragment, null, [
            props.wallet_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.wallet_success),
            props.wallet_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.wallet_error),
            !embedded && h("div", { className: "react-page-title" }, [
                h("h1", null, "\u041c\u043e\u0439 \u0431\u0430\u043b\u0430\u043d\u0441"),
                h("strong", { className: "react-price" }, money(available))
            ]),
            embedded && h("div", { className: "react-page-title" }, [
                h("h2", null, "\u041c\u043e\u0439 \u0431\u0430\u043b\u0430\u043d\u0441"),
                h("strong", { className: "react-price" }, money(available))
            ]),
            h("p", { className: "react-muted" }, "\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u043a \u0432\u044b\u0432\u043e\u0434\u0443 \u043f\u043e\u0441\u043b\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u044f \u0437\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044f\u043c\u0438."),
            h("div", { className: "react-actions" }, [
                h("form", { className: "react-panel react-stack", style: { flex: 1, minWidth: 280 }, action: "/payment/wallet/withdraw", method: "post", onSubmit: handleSubmitOnce }, [
                    h("h2", null, "\u0417\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u044c \u0432\u044b\u0432\u043e\u0434"),
                    Field({ name: "amount", type: "number", min: "1", max: available || undefined, step: "0.01", placeholder: "\u0421\u0443\u043c\u043c\u0430", required: true, disabled: !canWithdraw }),
                    h("button", { className: "react-btn", type: "submit", disabled: !canWithdraw }, "\u0417\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u044c \u0432\u044b\u0432\u043e\u0434")
                ]),
                ButtonLink({ href: embedded ? "/seller/?tab=history" : "/payment/transactions", className: "secondary" }, "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0439")
            ]),
            embedded ? null : h("section", { className: "react-panel" }, [
                h("h2", null, "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438"),
                ledger.length ? h("table", { className: "react-table" }, h("tbody", null, ledger.map(entry => h("tr", { key: entry.id }, [
                    h("td", null, dateText(entry.created_at)),
                    h("td", null, ledgerEntryTypeText(entry)),
                    h("td", null, `${entry.direction === "credit" ? "+" : "-"}${money(entry.amount)}`),
                    h("td", null, entry.order_id ? `#${entry.order_id}` : ""),
                    h("td", null, entry.description || "")
                ])))) : h("div", { className: "react-empty" }, "\u041e\u043f\u0435\u0440\u0430\u0446\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
            ])
        ]);
    }
    function TransactionsPage({ embedded }) {
        const entries = props.ledger_entries || [];
        const historyAction = embedded ? "/seller/" : "/payment/transactions";
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [
                h(embedded ? "h2" : "h1", null, "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0439"),
                ButtonLink({ href: embedded ? "/seller/?tab=finance" : "/payment/wallet", className: "secondary" }, "\u041c\u043e\u0439 \u0431\u0430\u043b\u0430\u043d\u0441")
            ]),
            h("form", { className: "react-panel react-form-grid", method: "get", action: historyAction }, [
                embedded ? h("input", { type: "hidden", name: "tab", value: "history" }) : null,
                Select({ name: "type_filter", defaultValue: props.type_filter || "" }, [
                    h("option", { value: "" }, "\u0412\u0441\u0435 \u0442\u0438\u043f\u044b"),
                    h("option", { value: "credit" }, "\u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f"),
                    h("option", { value: "debit" }, "\u0421\u043f\u0438\u0441\u0430\u043d\u0438\u044f")
                ]),
                Field({ name: "date_from", type: "date", defaultValue: props.date_from || "", placeholder: "\u0421 \u0434\u0430\u0442\u044b" }),
                Field({ name: "date_to", type: "date", defaultValue: props.date_to || "", placeholder: "\u041f\u043e \u0434\u0430\u0442\u0443" }),
                h("button", { className: "react-btn", type: "submit" }, "\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440")
            ]),
            h("section", { className: "react-panel" }, [
                entries.length ? h("table", { className: "react-table" }, h("thead", null, h("tr", null, [
                    h("th", null, "\u0414\u0430\u0442\u0430"),
                    h("th", null, "\u0422\u0438\u043f"),
                    h("th", null, "\u0421\u0443\u043c\u043c\u0430"),
                    h("th", null, "\u0417\u0430\u043a\u0430\u0437"),
                    h("th", null, "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435")
                ])), h("tbody", null, entries.map(entry => h("tr", { key: entry.id }, [
                    h("td", null, dateText(entry.created_at)),
                    h("td", null, ledgerEntryTypeText(entry)),
                    h("td", null, `${entry.direction === "credit" ? "+" : "-"}${money(entry.amount)}`),
                    h("td", null, entry.order_id ? `#${entry.order_id}` : "-"),
                    h("td", null, entry.description || "")
                ])))) : h("div", { className: "react-empty" }, "\u0417\u0430\u043f\u0438\u0441\u0435\u0439 \u043d\u0435\u0442.")
            ])
        ]);
    }
    function TransactionsTable({ transactions }) {
        return h("section", { className: "react-panel" }, [
            h("div", { className: "react-page-title" }, [h("h2", null, "\u041e\u043f\u0435\u0440\u0430\u0446\u0438\u0438"), ButtonLink({ href: "/payment/transactions", className: "secondary" }, "\u0418\u0441\u0442\u043e\u0440\u0438\u044f")]),
            h("table", { className: "react-table" }, h("tbody", null, (transactions || []).map(t => h("tr", { key: t.id }, [h("td", null, dateText(t.created_at)), h("td", null, transactionTypeText(t.type)), h("td", null, money(t.amount)), h("td", null, h(StatusChip, { value: t.status, label: transactionStatusText(t.status) })), h("td", null, t.description || "")]))))
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
                    h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441 \u043e\u043f\u043b\u0430\u0442\u044b"), h("p", null, paymentStatusText(order.payment_status))])
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
            props.notification_success && h("div", { className: "alert alert-success" }, props.notification_success),
            props.notification_error && h("div", { className: "alert alert-danger" }, props.notification_error),
            page === "notifications_admin" && h("form", { action: "/notifications/admin/broadcast", method: "post", className: "react-panel react-form-grid", onSubmit: handleSubmitOnce }, [
                Select({ name: "type", defaultValue: "push" }, [h("option", { value: "push" }, "Push"), h("option", { value: "email" }, "Email")]),
                Select({ name: "target_role", defaultValue: "all" }, [
                    h("option", { value: "all" }, "\u0412\u0441\u0435"),
                    h("option", { value: "user" }, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0438"),
                    h("option", { value: "seller" }, "\u0424\u0435\u0440\u043c\u0435\u0440\u044b"),
                    h("option", { value: "manager" }, "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u044b"),
                    h("option", { value: "accountant" }, "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u044b")
                ]),
                Field({ name: "subject", placeholder: "\u0422\u0435\u043c\u0430", required: true, maxLength: 500, className: "wide" }),
                Textarea({ name: "body", placeholder: "\u0422\u0435\u043a\u0441\u0442", className: "wide", required: true, maxLength: 4000 }),
                h("button", { className: "react-btn wide", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0440\u0430\u0441\u0441\u044b\u043b\u043a\u0443")
            ]),
            (props.notifications || []).length
                ? h("div", { className: "react-stack" }, (props.notifications || []).map(n => h("div", { key: n.id, className: "react-card" }, [h("b", null, n.subject), h("p", { className: "react-notification-body" }, n.body), h("span", { className: "react-muted" }, dateText(n.created_at))])))
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
                h("section", { className: "react-panel" }, [h("h2", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u0438"), h("p", { className: "react-price" }, money(stats.platform_fee_total))]),
                ButtonLink({ href: "/admin/manage?tab=finance", className: "react-btn" }, "\u0424\u0438\u043d\u0430\u043d\u0441\u044b: \u0432\u044b\u0432\u043e\u0434\u044b, \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u044b, \u0441\u043f\u043e\u0440\u044b")
            ])
        ]);
    }
    function withdrawalStatusText(value) {
        return ({ pending: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442", paid: "\u0412\u044b\u043f\u043b\u0430\u0447\u0435\u043d\u043e", rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043e" })[value] || value || "-";
    }
    function AdminFinancePanel({ embedded }) {
        const withdrawals = props.withdrawals || [];
        const paidOrders = props.paid_orders || [];
        const disputes = props.disputes || [];
        const platform = props.platform_wallet || {};
        const [tab, setTab] = React.useState("withdrawals");
        return h(React.Fragment, null, [
            !embedded && h("div", { className: "react-page-title" }, [
                h("h1", null, "\u0424\u0438\u043d\u0430\u043d\u0441\u044b \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b"),
                ButtonLink({ href: "/admin/manage", className: "secondary" }, "\u041a \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044e")
            ]),
            props.finance_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.finance_success),
            props.finance_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.finance_error),
            h("div", { className: "react-stat-grid" }, [
                h("div", { className: "react-card" }, [h("h2", null, money(platform.balance)), h("p", null, "\u0411\u0430\u043b\u0430\u043d\u0441 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b")]),
                h("div", { className: "react-card" }, [h("h2", null, money(platform.held_balance)), h("p", null, "\u0412 \u0443\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0438 (\u044d\u0441\u043a\u0440\u043e\u0443)")])
            ]),
            h("div", { className: "react-tab-row" }, [
                h("button", { type: "button", className: `react-btn ${tab === "withdrawals" ? "" : "secondary"}`, onClick: () => setTab("withdrawals") }, "\u0417\u0430\u044f\u0432\u043a\u0438 \u043d\u0430 \u0432\u044b\u0432\u043e\u0434"),
                h("button", { type: "button", className: `react-btn ${tab === "refunds" ? "" : "secondary"}`, onClick: () => setTab("refunds") }, "\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b"),
                h("button", { type: "button", className: `react-btn ${tab === "disputes" ? "" : "secondary"}`, onClick: () => setTab("disputes") }, "\u0421\u043f\u043e\u0440\u044b")
            ]),
            tab === "withdrawals" && h("section", { className: "react-panel" }, [
                h("h2", null, "\u0417\u0430\u044f\u0432\u043a\u0438 \u043d\u0430 \u0432\u044b\u0432\u043e\u0434"),
                withdrawals.length ? h("table", { className: "react-table" }, h("tbody", null, withdrawals.map(row => h("tr", { key: row.id }, [
                    h("td", null, row.seller ? (row.seller.farm_name || row.seller.full_name || row.seller.email) : `#${row.seller_id}`),
                    h("td", null, money(row.amount)),
                    h("td", null, dateText(row.created_at)),
                    h("td", null, h(StatusChip, { value: row.status, label: withdrawalStatusText(row.status) })),
                    h("td", null, row.status === "pending" ? h("div", { className: "react-actions" }, [
                        PostButton({ action: `/admin/finance/withdrawals/${row.id}/approve`, children: "\u0412\u044b\u043f\u043b\u0430\u0447\u0435\u043d\u043e", confirmMessage: "\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043b\u0430\u0442\u0443 \u043d\u0430 \u0440/\u0441 \u0444\u0435\u0440\u043c\u0435\u0440\u0430?" }),
                        h("form", { action: `/admin/finance/withdrawals/${row.id}/reject`, method: "post", className: "react-inline-form", onSubmit: handleSubmitOnce }, [
                            Field({ name: "comment", placeholder: "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0438\u044f" }),
                            h("button", { type: "submit", className: "react-btn danger" }, "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c")
                        ])
                    ]) : (row.admin_comment || ""))
                ])))) : h("div", { className: "react-empty" }, "\u0417\u0430\u044f\u0432\u043e\u043a \u043d\u0435\u0442.")
            ]),
            tab === "refunds" && h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0432\u043e\u0437\u0432\u0440\u0430\u0442 (\u042eKassa)"),
                h("form", { action: "/admin/finance/refunds", method: "post", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Field({ name: "order_id", type: "number", placeholder: "ID \u0437\u0430\u043a\u0430\u0437\u0430", required: true }),
                    Field({ name: "amount", type: "number", min: "0", step: "0.01", placeholder: "\u0421\u0443\u043c\u043c\u0430 (\u043f\u0443\u0441\u0442\u043e = \u0432\u0435\u0441\u044c \u0437\u0430\u043a\u0430\u0437)" }),
                    Textarea({ name: "reason", placeholder: "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u0430", className: "wide", rows: 2 }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u0412\u044b\u0437\u0432\u0430\u0442\u044c \u0432\u043e\u0437\u0432\u0440\u0430\u0442")
                ]),
                h("h3", null, "\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b"),
                paidOrders.length ? h("table", { className: "react-table" }, h("tbody", null, paidOrders.slice(0, 30).map(order => h("tr", { key: order.id }, [
                    h("td", null, orderDisplayNumber(order)),
                    h("td", null, order.user ? order.user.email : "-"),
                    h("td", null, money(order.total_price)),
                    h("td", null, h(StatusChip, { value: order.escrow_status || "pending", label: order.escrow_status || "pending" }))
                ])))) : null
            ]),
            tab === "disputes" && h("section", { className: "react-panel" }, [
                h("h2", null, "\u0421\u043f\u043e\u0440\u043d\u044b\u0435 \u0442\u0440\u0430\u043d\u0437\u0430\u043a\u0446\u0438\u0438"),
                disputes.length ? h("table", { className: "react-table" }, h("tbody", null, disputes.map(d => h("tr", { key: d.id }, [
                    h("td", null, `#${d.id}`),
                    h("td", null, d.order_id ? `Заказ #${d.order_id}` : "-"),
                    h("td", null, money(d.amount)),
                    h("td", null, d.status),
                    h("td", null, d.status === "open" ? h("div", { className: "react-actions" }, [
                        h("form", { action: `/admin/finance/disputes/${d.id}/resolve`, method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                            h("input", { type: "hidden", name: "resolution", value: "refund_buyer" }),
                            Textarea({ name: "note", placeholder: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439", rows: 2 }),
                            h("button", { type: "submit", className: "react-btn danger" }, "\u0412\u043e\u0437\u0432\u0440\u0430\u0442 \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044e")
                        ]),
                        h("form", { action: `/admin/finance/disputes/${d.id}/resolve`, method: "post", className: "react-stack", onSubmit: handleSubmitOnce }, [
                            h("input", { type: "hidden", name: "resolution", value: "keep_seller" }),
                            h("button", { type: "submit", className: "react-btn secondary" }, "\u0412 \u043f\u043e\u043b\u044c\u0437\u0443 \u0444\u0435\u0440\u043c\u0435\u0440\u0430")
                        ])
                    ]) : (d.resolution_note || ""))
                ])))) : h("div", { className: "react-empty" }, "\u0421\u043f\u043e\u0440\u043e\u0432 \u043d\u0435\u0442.")
            ])
        ]);
    }
    function AdminFinancePage() {
        return h(AdminFinancePanel, { embedded: false });
    }
    function BackupsPage() {
        const backups = props.backups || [];
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [
                h("h1", null, "\u0420\u0435\u0437\u0435\u0440\u0432\u043d\u043e\u0435 \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435"),
                PostButton({ action: "/admin/backups/create", children: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0440\u0435\u0437\u0435\u0440\u0432\u043d\u0443\u044e \u043a\u043e\u043f\u0438\u044e", className: "react-btn" })
            ]),
            props.backup_success && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.backup_success),
            props.backup_error && h("div", { className: "react-panel", style: { borderColor: "#d9534f", color: "#8a1f17" } }, props.backup_error),
            h("section", { className: "react-panel" }, [
                h("h2", null, "\u0421\u043e\u0437\u0434\u0430\u043d\u043d\u044b\u0435 ZIP-\u0430\u0440\u0445\u0438\u0432\u044b"),
                backups.length
                    ? h("table", { className: "react-table" }, [
                        h("thead", null, h("tr", null, [
                            h("th", null, "\u0410\u0440\u0445\u0438\u0432"),
                            h("th", null, "\u0421\u043e\u0437\u0434\u0430\u043d"),
                            h("th", null, "\u0420\u0430\u0437\u043c\u0435\u0440")
                        ])),
                        h("tbody", null, backups.map(archive => h("tr", { key: archive.name }, [
                            h("td", null, archive.name),
                            h("td", null, dateTimeText(archive.created_at)),
                            h("td", null, formatFileSize(archive.size))
                        ])))
                    ])
                    : h("div", { className: "react-empty" }, "\u0410\u0440\u0445\u0438\u0432\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
            ])
        ]);
    }
    function AdminOrdersTable({ orders, orderStatuses, statusLabels, clientOrdersByUser }) {
        const list = orders || [];
        if (!list.length) return h("div", { className: "react-empty react-panel" }, "\u0417\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.");
        return h("section", { className: "react-stack" }, list.map(order => {
            const buyer = order.user || {};
            const delivery = order.delivery || {};
            const customerName = order.customer_name || buyer.full_name || buyer.email || "\u041a\u043b\u0438\u0435\u043d\u0442";
            const customerPhone = order.customer_phone || buyer.phone || "";
            const address = order.delivery_address || delivery.address || "";
            const slot = order.delivery_slot || delivery.delivery_slot || "";
            const method = order.delivery_method || delivery.method || "";
            const trackNumber = delivery.track_number || order.delivery_track_number || "";
            const trackUrl = delivery.tracking_url || order.delivery_tracking_url || (trackNumber ? `/delivery/track/${encodeURIComponent(trackNumber)}` : "");
            const clientOrders = (clientOrdersByUser && clientOrdersByUser[String(order.user_id)]) || [];
            return h("div", { key: order.id, id: `order-${order.id}`, className: "react-panel" }, [
                h("div", { className: "react-page-title" }, [
                    h("div", null, [
                        h("h2", null, `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(order)}`),
                        h("p", { className: "react-muted" }, `ID: ${order.id}`)
                    ]),
                    h("strong", null, h(PriceDisplay, { product: { price: order.total_price }, compact: true, inline: true }))
                ]),
                h("div", { className: "react-chip-row" }, [
                    h(StatusChip, { value: order.status, label: statusLabels && statusLabels[order.status] ? statusLabels[order.status] : (order.status || "created") }),
                    h(StatusChip, { value: order.payment_status, label: paymentStatusText(order.payment_status) })
                ]),
                h("div", { className: "react-info-grid react-order-meta-grid" }, [
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u041a\u043b\u0438\u0435\u043d\u0442"),
                        h("p", null, customerName),
                        customerPhone ? h("p", { className: "react-muted" }, customerPhone) : null,
                        buyer.email ? h("p", { className: "react-muted" }, buyer.email) : null
                    ]),
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"),
                        h("p", null, deliveryMethodText(method) || "\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430"),
                        slot ? h("p", { className: "react-muted" }, slot) : null,
                        address ? h("p", { className: "react-muted" }, address) : null
                    ]),
                    h("div", { className: "react-card" }, [
                        h("b", null, "\u0422\u0440\u0435\u043a\u0438\u043d\u0433"),
                        h("p", null, deliveryStatusText({ ...order, delivery })),
                        h(CdekDeliveryBadge, { method, provider: delivery.provider, trackNumber }),
                        trackNumber ? h("p", { className: "react-muted" }, trackNumber) : h("p", { className: "react-muted" }, "\u0422\u0440\u0435\u043a-\u043d\u043e\u043c\u0435\u0440 \u0435\u0449\u0435 \u043d\u0435 \u0432\u044b\u0434\u0430\u043d"),
                        trackUrl ? ButtonLink({ href: trackUrl, className: "secondary" }, "\u041e\u0442\u0441\u043b\u0435\u0434\u0438\u0442\u044c") : null
                    ])
                ]),
                clientOrders.length ? h("div", { className: "react-card" }, [
                    h("b", null, "\u0412\u0441\u0435 \u0437\u0430\u043a\u0430\u0437\u044b \u043a\u043b\u0438\u0435\u043d\u0442\u0430"),
                    h("div", { className: "react-stack compact" }, clientOrders.map(clientOrder => h("a", { key: clientOrder.id, href: `#order-${clientOrder.id}`, className: "react-row-link" }, [
                        h("span", null, orderDisplayNumber(clientOrder)),
                        h("span", null, money(clientOrder.total_price)),
                        h("span", { className: "react-muted" }, orderStatusText(clientOrder, statusLabels))
                    ])))
                ]) : null,
                isOrderCancelled(order) && (order.return_reason || order.seller_cancel_reason)
                    ? h("p", { className: "react-muted" }, order.return_reason || order.seller_cancel_reason)
                    : null,
                h("table", { className: "react-table" }, h("tbody", null, (order.items || []).map(item => h("tr", { key: item.id }, [
                    h("td", null, item.product ? h(ProductMiniPreview, { product: item.product }) : "\u0422\u043e\u0432\u0430\u0440"),
                    h("td", null, item.quantity),
                    h("td", null, item.product ? h(PriceDisplay, { product: item.product, compact: true, inline: true }) : ""),
                    h("td", null, item.product ? money(productFinalPrice(item.product) * Number(item.quantity || 0)) : ""),
                    h("td", null, h(OrderItemExcludeAction, { order, item, role: "admin" }))
                ])))),
                h("div", { className: "react-actions" }, [
                    h("form", { action: `/admin/order/status/${order.id}`, method: "post", className: "react-inline-form", onSubmit: handleSubmitOnce }, [
                        Select({ name: "status", defaultValue: order.status || "created" }, (orderStatuses || []).filter(status => status !== "cancelled").map(status => h("option", { key: status, value: status }, statusLabels && statusLabels[status] ? statusLabels[status] : status))),
                        h("button", { className: "react-btn secondary", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441")
                    ]),
                    h(AdminOrderCancelForm, { order })
                ])
            ]);
        }));
    }
    function AdminUsersTable({ users }) {
        const list = users || [];
        return h("section", { className: "react-panel" }, [
            h("h2", null, "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438"),
            h("table", { className: "react-table" }, [
                h("thead", null, h("tr", null, [
                    h("th", null, "Email"),
                    h("th", null, "\u0420\u043e\u043b\u044c"),
                    h("th", null, "\u0421\u0442\u0430\u0442\u0443\u0441"),
                    h("th", null, "\u041d\u043e\u0432\u0430\u044f \u0440\u043e\u043b\u044c"),
                    h("th", null, "\u0410\u043d\u043a\u0435\u0442\u0430")
                ])),
                h("tbody", null, list.map(userItem => h("tr", { key: userItem.id }, [
                h("td", null, userItem.email),
                h("td", null, h(StatusChip, { value: userItem.role, label: roleText(userItem.role) })),
                h("td", null, h(StatusChip, { value: userItem.role === "seller" ? userItem.seller_application_status : (userItem.is_approved ? "approved" : "pending"), label: userItem.role === "seller" ? sellerApplicationStatusText(userItem.seller_application_status) : (userItem.is_approved ? "\u043e\u0434\u043e\u0431\u0440\u0435\u043d" : "\u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438") })),
                h("td", null, h("form", { action: `/admin/user/role/${userItem.id}`, method: "post", className: "react-actions", onSubmit: handleSubmitOnce }, [
                    Select({ name: "role", defaultValue: userItem.role }, ["user", "seller", "manager", "admin", "accountant"].map(role => h("option", { key: role, value: role }, roleText(role)))),
                    h("button", { className: "react-btn secondary", type: "submit" }, "\u0420\u043e\u043b\u044c")
                ])),
                h("td", null, userItem.role === "seller" && h("form", { action: `/admin/user/approve/${userItem.id}`, method: "post", className: "react-actions", onSubmit: handleSubmitOnce }, [
                    h("input", { type: "hidden", name: "approved", value: userItem.seller_application_status === "approved" ? "0" : "1" }),
                    h("button", { className: `react-btn ${userItem.seller_application_status === "approved" ? "danger" : "secondary"}`, type: "submit" }, userItem.seller_application_status === "approved" ? "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c" : "\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c")
                ]))
            ])))
            ])
        ]);
    }
    function AdminProductsTable({ products }) {
        const list = products || [];
        return h("section", { className: "react-panel" }, [
            h("h2", null, "\u0422\u043e\u0432\u0430\u0440\u044b"),
            h("table", { className: "react-table" }, [
                h("thead", null, h("tr", null, [
                    h("th", null, "\u0422\u043e\u0432\u0430\u0440"),
                    h("th", null, "\u0426\u0435\u043d\u0430"),
                    h("th", null, "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f"),
                    h("th", null, "\u0421\u0442\u0430\u0442\u0443\u0441"),
                    h("th", null, "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f")
                ])),
                h("tbody", null, list.map(product => {
                const productHref = `/product/${product.id}`;
                const rowProps = interactiveRowProps(productHref);
                rowProps.key = product.id;
                return h("tr", rowProps, [
                    h("td", null, A({ href: productHref }, product.name)),
                    h("td", null, h(PriceDisplay, { product, compact: true, inline: true })),
                    h("td", null, product.category || "-"),
                    h("td", null, h(StatusChip, { value: product.status, label: productStatusText(product.status) })),
                    h("td", null, h("div", { className: "react-actions" }, [
                        ButtonLink({ href: productHref, className: "secondary" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c"),
                        PostButton({ action: `/admin/product/delete/${product.id}`, children: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c", className: "react-btn danger", confirmMessage: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440?" })
                    ]))
                ]);
            }))
            ])
        ]);
    }
    function AdminManagePage() {
        const [tab, setTab] = React.useState(props.initial_tab || "products");
        const tabs = [
            { id: "products", label: "\u0422\u043e\u0432\u0430\u0440\u044b" },
            { id: "users", label: "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438" },
            { id: "orders", label: "\u0417\u0430\u043a\u0430\u0437\u044b" },
            { id: "finance", label: "\u0424\u0438\u043d\u0430\u043d\u0441\u044b", href: "/admin/manage?tab=finance" }
        ];
        function manageTabButton(item) {
            if (item.href) {
                return A({
                    key: item.id,
                    href: item.href,
                    className: `react-btn ${tab === item.id ? "" : "secondary"}`
                }, item.label);
            }
            return h("button", {
                key: item.id,
                type: "button",
                className: `react-btn ${tab === item.id ? "" : "secondary"}`,
                onClick: () => setTab(item.id)
            }, item.label);
        }
        return h(React.Fragment, null, [
            h("div", { className: "react-page-title" }, [h("h1", null, "\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435")]),
            props.admin_success && h("div", { className: "alert alert-success" }, props.admin_success),
            props.admin_error && h("div", { className: "alert alert-danger" }, props.admin_error),
            h("div", { className: "react-tab-row" }, tabs.map(manageTabButton)),
            tab === "products" && h(AdminProductsTable, { products: props.products || [] }),
            tab === "users" && h(AdminUsersTable, { users: props.users || [] }),
            tab === "orders" && h(AdminOrdersTable, { orders: props.orders || [], orderStatuses: props.order_statuses || [], statusLabels: props.status_labels || {}, clientOrdersByUser: props.client_orders_by_user || {} }),
            tab === "finance" && h(AdminFinancePanel, { embedded: true })
        ]);
    }
    function ModerationPage() {
        const pendingProducts = props.pending_products || [];
        const farmerApplications = props.farmer_applications || props.pending_sellers || [];
        const farmerStatusOptions = props.farmer_application_statuses || ["new", "in_progress", "waiting_documents", "approved", "rejected"];
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
                    pendingProducts.length ? h("table", { className: "react-table" }, [
                        h("thead", null, h("tr", null, [
                            h("th", null, "\u0422\u043e\u0432\u0430\u0440"),
                            h("th", null, "\u0424\u0435\u0440\u043c\u0435\u0440"),
                            h("th", null, "\u0421\u0442\u0430\u0442\u0443\u0441"),
                            h("th", null, "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f")
                        ])),
                        h("tbody", null, pendingProducts.map(product => {
                        const productHref = `/product/${product.id}`;
                        const rowProps = interactiveRowProps(productHref);
                        rowProps.key = product.id;
                        return h("tr", rowProps, [
                            h("td", null, A({ href: productHref }, product.name)),
                            h("td", null, ownerName(product)),
                            h("td", null, h(StatusChip, { value: product.status, label: productStatusText(product.status) })),
                    h("td", null, h("div", { className: "react-actions" }, [
                                ButtonLink({ href: productHref, className: "secondary" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c"),
                                PostButton({ action: `/admin/product/approve/${product.id}`, children: "\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c" }),
                                h("form", { action: `/admin/product/reject/${product.id}`, method: "post", className: "react-inline-form", onSubmit: handleSubmitOnce }, [
                                    h("input", { type: "hidden", name: "reason", value: "\u041d\u0435 \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043f\u0440\u0430\u0432\u0438\u043b\u0430\u043c \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b" }),
                                    h("button", { className: "react-btn danger", type: "submit" }, "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c")
                                ])
                            ]))
                        ]);
                    }))
                    ]) : h("div", { className: "react-empty" }, "\u041d\u0435\u0442 \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435.")
                ])
            ]),
            tab === "sellers" && h("section", { className: "react-panel" }, [
                h("h2", null, "\u0417\u0430\u044f\u0432\u043a\u0438 \u0444\u0435\u0440\u043c\u0435\u0440\u043e\u0432"),
                farmerApplications.length ? h("div", { className: "react-farmer-app-list" }, farmerApplications.map(seller => h("article", { key: seller.id, className: "react-farmer-app-card" }, [
                    h("header", { className: "react-farmer-app-head" }, [
                        h("div", { className: "react-farmer-app-title" }, [
                            h("h3", null, seller.farm_name || "\u0425\u043e\u0437\u044f\u0439\u0441\u0442\u0432\u043e \u0431\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f"),
                            h("span", { className: "react-muted" }, seller.full_name || "\u041f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044c \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d")
                        ]),
                        h("div", { className: "react-chip-row" }, [
                            h("span", { className: "react-chip" }, sellerApplicationStatusText(seller.seller_application_status)),
                            h("span", { className: "react-chip" }, `\u2116 ${farmerApplicationNumber(seller)}`)
                        ])
                    ]),
                    h("div", { className: "react-farmer-app-body" }, [
                        h("div", { className: "react-farmer-app-main" }, [
                            h("div", { className: "react-farmer-app-fields" }, [
                                h("div", { className: "react-farmer-app-field" }, [h("b", null, "Email"), h("span", null, seller.email || "-")]),
                                h("div", { className: "react-farmer-app-field" }, [h("b", null, "\u0422\u0435\u043b\u0435\u0444\u043e\u043d"), h("span", null, seller.phone || "-")]),
                                h("div", { className: "react-farmer-app-field" }, [h("b", null, "\u0420\u0435\u0433\u0438\u043e\u043d"), h("span", null, seller.farm_address || "-")]),
                                h("div", { className: "react-farmer-app-field react-farmer-app-field-wide" }, [h("b", null, "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438"), h("span", null, seller.product_categories || "-")])
                            ]),
                            h("div", { className: "react-farmer-app-description" }, [
                                h("b", null, "\u041a\u0440\u0430\u0442\u043a\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"),
                                h("p", null, seller.farm_description || "\u041d\u0435\u0442 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f")
                            ]),
                            seller.seller_application_rejection_reason ? h("div", { className: "alert alert-danger" }, seller.seller_application_rejection_reason) : null
                        ]),
                        h("form", { action: `/admin/farmer-application/${seller.id}/status`, method: "post", className: "react-farmer-app-form", onSubmit: handleSubmitOnce }, [
                            h("label", null, [
                                h("span", null, "\u0421\u0442\u0430\u0442\u0443\u0441"),
                                h("select", { name: "status", className: "react-input", defaultValue: seller.seller_application_status || "new" }, farmerStatusOptions.map(status => h("option", { key: status, value: status }, sellerApplicationStatusText(status))))
                            ]),
                            h("label", null, [
                                h("span", null, "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"),
                                Textarea({ name: "comment", placeholder: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0430\u0434\u043c\u0438\u043d\u0430", defaultValue: seller.seller_application_admin_comment || seller.seller_application_rejection_reason || "", rows: 3, maxLength: 2000 })
                            ]),
                            h("button", { className: "react-btn", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c")
                        ])
                    ])
                ]))) : h("div", { className: "react-empty" }, "\u0417\u0430\u044f\u0432\u043e\u043a \u0444\u0435\u0440\u043c\u0435\u0440\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.")
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
                    h("td", null, h(StatusChip, { value: complaint.status, label: complaintStatusText(complaint.status) })),
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
                    h("td", null, h(StatusChip, { value: order.payout_status || "pending", label: payoutStatusText(order.payout_status || "pending") })),
                    h("td", null, h("div", { className: "react-actions" }, [
                        ButtonLink({ href: `/accounting/orders/${order.id}`, className: "secondary" }, "\u0414\u0435\u0442\u0430\u043b\u0438"),
                        (order.payout_status || "pending") !== "transferred_to_partner" && PostButton({
                            action: `/accounting/orders/${order.id}/payout`,
                            children: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0432\u044b\u043f\u043b\u0430\u0442\u0443 \u0444\u0435\u0440\u043c\u0435\u0440\u0443",
                            confirmMessage: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c, \u0447\u0442\u043e \u0432\u044b\u043f\u043b\u0430\u0442\u0430 \u0444\u0435\u0440\u043c\u0435\u0440\u0443 \u043f\u043e \u044d\u0442\u043e\u043c\u0443 \u0437\u0430\u043a\u0430\u0437\u0443 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0430?"
                        }),
                        order.payment_status === "paid" && PostButton({ action: `/accounting/orders/${order.id}/refund`, children: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442", className: "react-btn danger", confirmMessage: "\u0418\u043d\u0438\u0446\u0438\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u043e\u0437\u0432\u0440\u0430\u0442 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443?" })
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
            h(OrderCancelStatusBlock, { order, statusLabels: props.status_labels }),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u041a\u043b\u0438\u0435\u043d\u0442"), h("div", null, order.user ? (order.user.full_name || order.user.email || "-") : "-")]),
                h("div", { className: "react-card" }, [
                    h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"),
                    h("div", null, h("span", { className: `react-chip react-status-chip status-${order.status || "created"}` }, orderStatusText(order, props.status_labels)))
                ]),
                h("div", { className: "react-card" }, [h("b", null, "\u041e\u043f\u043b\u0430\u0442\u0430"), h("div", null, paymentStatusText(order.payment_status))]),
                h("div", { className: "react-card" }, [h("b", null, "\u0412\u044b\u043f\u043b\u0430\u0442\u0430"), h("div", null, payoutStatusText(order.payout_status || "pending"))])
            ]),
            h("section", { className: "react-panel" }, [
                h("h2", null, "\u0421остав заказа"),
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
                    (order.payout_status || "pending") !== "transferred_to_partner" && PostButton({
                        action: `/accounting/orders/${order.id}/payout`,
                        children: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0432\u044b\u043f\u043b\u0430\u0442\u0443 \u0444\u0435\u0440\u043c\u0435\u0440\u0443",
                        confirmMessage: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c, \u0447\u0442\u043e \u0432\u044b\u043f\u043b\u0430\u0442\u0430 \u0444\u0435\u0440\u043c\u0435\u0440\u0443 \u043f\u043e \u044d\u0442\u043e\u043c\u0443 \u0437\u0430\u043a\u0430\u0437\u0443 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0430?"
                    }),
                    order.payment_status === "paid" && PostButton({ action: `/accounting/orders/${order.id}/refund`, children: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442", className: "react-btn danger", confirmMessage: "\u0418\u043d\u0438\u0446\u0438\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u043e\u0437\u0432\u0440\u0430\u0442 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443?" })
                ])
            ])
        ]);
    }
    function ComplaintsPage() {
        const list = props.complaints || [];
        const isAdminView = page === "complaints_admin";
        return h("section", { className: "react-panel react-complaints-shell" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, isAdminView ? "\u0416\u0430\u043b\u043e\u0431\u044b" : "\u041c\u043e\u0438 \u0436\u0430\u043b\u043e\u0431\u044b"),
                    h("p", { className: "react-muted" }, isAdminView ? "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0435\u0439, \u0444\u0435\u0440\u043c\u0435\u0440\u043e\u0432 \u0438 \u0437\u0430\u043a\u0430\u0437\u043e\u0432" : "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0432\u0430\u0448\u0438\u0445 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0439")
                ])
            ]),
            props.complaint_success && h("div", { className: "react-alert alert-success" }, props.complaint_success),
            props.complaint_error && h("div", { className: "react-alert alert-danger" }, props.complaint_error),
            list.length ? h("div", { className: "react-complaint-list" }, list.map(item => {
                const c = item.complaint || item;
                const detailHref = isAdminView ? `/complaints/admin/${c.id}` : `/complaints/my/${c.id}`;
                const rowProps = interactiveRowProps(detailHref);
                const author = item.author;
                const targetUser = item.target_user;
                const targetProduct = item.target_product;
                rowProps.key = c.id;
                rowProps.className = `${rowProps.className} react-card react-complaint-card`;
                return h("article", rowProps, [
                    h("div", { className: "react-complaint-card-head" }, [
                        h("div", null, [
                            h("b", null, COMPLAINT_CATEGORY_LABELS[c.category] || c.category || c.type || "\u0416\u0430\u043b\u043e\u0431\u0430"),
                            h("p", { className: "react-muted" }, `#${c.id} \u00b7 ${dateText(c.created_at) || "\u0434\u0430\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"}`)
                        ]),
                        h(StatusChip, { value: c.status, label: complaintStatusText(c.status) })
                    ]),
                    h("p", { className: "react-complaint-text" }, c.text || "\u0411\u0435\u0437 \u0442\u0435\u043a\u0441\u0442\u0430"),
                    h("div", { className: "react-complaint-meta" }, [
                        isAdminView && h("span", null, ["\u0410\u0432\u0442\u043e\u0440: ", h("b", null, author ? (author.full_name || author.email || `#${author.id}`) : "\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d")]),
                        targetUser && h("span", null, ["\u0424\u0435\u0440\u043c\u0435\u0440: ", h("b", null, targetUser.farm_name || targetUser.full_name || targetUser.email || `#${targetUser.id}`)]),
                        targetProduct && h("span", null, ["\u0422\u043e\u0432\u0430\u0440: ", h("b", null, targetProduct.name || `#${targetProduct.id}`)]),
                        c.order_id && h("span", null, ["\u0417\u0430\u043a\u0430\u0437: ", h("b", null, `#${c.order_id}`)])
                    ].filter(Boolean)),
                    c.attachment_path && ButtonLink({ href: c.attachment_path, className: "secondary" }, "\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u0435"),
                    h("div", { className: "react-complaint-card-actions" }, [
                        ButtonLink({ href: detailHref }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c")
                    ]),
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
                    h("b", null, `${COMPLAINT_CATEGORY_LABELS[c.category] || c.type || "\u0416\u0430\u043b\u043e\u0431\u0430"} \u00b7 ${complaintStatusText(c.status)}`),
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
        return h("section", { className: "react-panel react-reviews-moderation" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, "\u041e\u0442\u0437\u044b\u0432\u044b \u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438"),
                    h("p", { className: "react-muted" }, "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0435\u0439 \u043f\u043e\u0441\u043b\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432")
                ])
            ]),
            list.length ? h("div", { className: "react-review-mod-list" }, list.map(item => {
                const review = item.review || item;
                if (!review || !review.id) return null;
                const order = item.order || {};
                const seller = item.seller || {};
                const productHref = item.product_id ? `/product/${item.product_id}` : null;
                const orderLabel = orderDisplayNumber(order) || (item.order_id ? `#${item.order_id}` : "\u2014");
                const sellerLabel = seller.farm_name || seller.full_name || seller.email || "\u2014";
                return h("article", { key: review.id, className: "react-card react-review-mod-card" }, [
                    h("header", { className: "react-review-mod-head" }, [
                        h("div", null, [
                            productHref
                                ? A({ href: productHref, className: "react-review-mod-product" }, item.product_name || "\u0422\u043e\u0432\u0430\u0440")
                                : h("b", { className: "react-review-mod-product" }, item.product_name || "\u0422\u043e\u0432\u0430\u0440"),
                            h("p", { className: "react-muted" }, `#${review.id} \u00b7 ${dateText(review.created_at) || ""}`)
                        ]),
                        h("div", { className: "react-review-stars", "aria-label": `\u041e\u0446\u0435\u043d\u043a\u0430 ${review.rating || 0} \u0438\u0437 5` }, renderStars(review.rating || 0))
                    ]),
                    h("div", { className: "react-review-mod-meta" }, [
                        h("div", { className: "react-card react-review-mod-meta-item" }, [
                            h("b", null, "\u0417\u0430\u043a\u0430\u0437"),
                            h("p", null, orderLabel)
                        ]),
                        h("div", { className: "react-card react-review-mod-meta-item" }, [
                            h("b", null, "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c"),
                            h("p", null, sellerLabel)
                        ]),
                        h("div", { className: "react-card react-review-mod-meta-item" }, [
                            h("b", null, "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c"),
                            h("p", null, item.user_name || item.user_email || "\u2014")
                        ])
                    ]),
                    h("blockquote", { className: "react-review-mod-text" }, review.text || "\u0411\u0435\u0437 \u0442\u0435\u043a\u0441\u0442\u0430"),
                    h("div", { className: "react-actions" }, [
                        productHref && ButtonLink({ href: productHref, className: "secondary" }, "\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u0442\u043e\u0432\u0430\u0440\u0430"),
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
            const convStatus = conv.type === "product_question"
                ? normalizeProductQuestionStatus(conv.status)
                : (conv.status || "open");
            const matchesStatus = statusFilter === "all"
                || convStatus === statusFilter
                || (statusFilter === "resolved" && (conv.status || "") === "closed")
                || (statusFilter === "closed" && convStatus === "resolved");
            return (kindFilter === "all" || (conv.type || "") === kindFilter) && matchesStatus;
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
                h("button", { type: "button", className: `react-btn ${statusFilter === "resolved" ? "" : "secondary"}`, onClick: () => setStatusFilter("resolved") }, "\u0420\u0435\u0448\u0451\u043d\u043d\u044b\u0435"),
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
                    h(StatusChip, {
                        value: conv.type === "product_question" ? normalizeProductQuestionStatus(conv.status) : (conv.status || "open"),
                        label: conv.type === "product_question"
                            ? productQuestionStatusText(normalizeProductQuestionStatus(conv.status))
                            : conversationStatusText(conv.status || "open")
                    }),
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
        const isProductQuestion = conversation.type === "product_question";
        const questionStatus = isProductQuestion ? normalizeProductQuestionStatus(conversation.status) : (conversation.status || "open");
        const questionStatusLabels = props.product_question_status_labels || {
            open: "\u041e\u0442\u043a\u0440\u044b\u0442",
            resolved: "\u0420\u0435\u0448\u0451\u043d"
        };
        const questionStatusOptions = props.product_question_statuses || PRODUCT_QUESTION_STATUS_OPTIONS;
        const label = {
            order_chat: "\u0417\u0430\u043a\u0430\u0437",
            product_question: "\u0422\u043e\u0432\u0430\u0440",
            complaint: "\u0416\u0430\u043b\u043e\u0431\u0430",
            support_request: "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430",
            finance_request: "\u0424\u0438\u043d\u0430\u043d\u0441\u044b"
        }[conversation.type] || conversation.type || "\u0414\u0438\u0430\u043b\u043e\u0433";
        const title = conversation.order ? `\u0417\u0430\u043a\u0430\u0437 ${orderDisplayNumber(conversation.order)}` : conversation.product ? conversation.product.name : `#${conversation.id || ""}`;
        return h("section", { className: "react-panel react-stack" }, [
            props.notice_message && h("div", { className: "react-panel", style: { borderColor: "#2d8a4f", color: "#1f5d35" } }, props.notice_message),
            h("div", { className: "react-page-title" }, [
                h("div", null, [h("h1", null, title), h("p", { className: "react-muted" }, label)]),
                ButtonLink({ href: "/conversations/", className: "secondary" }, "\u041a \u0434\u0438\u0430\u043b\u043e\u0433\u0430\u043c")
            ]),
            h("div", { className: "react-info-grid" }, [
                h("div", { className: "react-card" }, [h("b", null, "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438"), h("p", null, [
                    conversationParticipantName(conversation.buyer, "user"),
                    " / ",
                    conversationParticipantName(conversation.farmer, "seller")
                ])]),
                h("div", { className: "react-card" }, [
                    h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"),
                    h(StatusChip, {
                        value: questionStatus,
                        label: isProductQuestion
                            ? productQuestionStatusText(questionStatus, questionStatusLabels)
                            : conversationStatusText(conversation.status || "open")
                    }),
                    props.can_change_status && h("form", {
                        action: `/conversations/${conversation.id}/status`,
                        method: "post",
                        className: "react-form-grid",
                        style: { marginTop: 12 },
                        onSubmit: handleSubmitOnce
                    }, [
                        Select({ name: "status", defaultValue: questionStatus }, questionStatusOptions.map(status => h("option", { key: status, value: status }, productQuestionStatusText(status, questionStatusLabels)))),
                        h("button", { className: "react-btn", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441")
                    ])
                ]),
                conversation.product && h("div", { className: "react-card" }, [h("b", null, "\u0422\u043e\u0432\u0430\u0440"), h("p", null, conversation.product.name)]),
                conversation.complaint && h("div", { className: "react-card" }, [h("b", null, "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435"), h("p", null, COMPLAINT_CATEGORY_LABELS[conversation.complaint.category] || conversation.complaint.category || "-")])
            ]),
            h("section", { className: "react-panel react-stack" }, [
                h("h2", null, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f"),
                messages.length ? h("div", { className: "react-chat-list" }, messages.map(message => h("div", { key: message.id, className: `react-chat-message${message.sender_id === (user && user.id) ? " own" : ""}` }, [
                    h("b", null, `${messageSenderName(message.sender)} \u00b7 ${roleText(message.sender_role)}`),
                    message.text && message.text !== "\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u0435" ? h("p", null, message.text) : null,
                    message.attachment_path ? A({ href: message.attachment_path, target: "_blank", className: "react-chat-attachment" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0432\u043b\u043e\u0436\u0435\u043d\u0438\u0435") : null,
                    h("span", { className: "react-muted" }, dateText(message.created_at))
                ]))) : h("div", { className: "react-empty" }, "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."),
                props.can_reply && h("form", { action: `/conversations/${conversation.id}/message`, method: "post", encType: "multipart/form-data", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                    Textarea({ name: "text", placeholder: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435", className: "wide", rows: 4, maxLength: 2000 }),
                    h("input", { name: "attachment", type: "file", className: "react-input wide", accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" }),
                    h("button", { className: "react-btn wide", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c")
                ])
            ])
        ]);
    }
    function complaintParticipantName(person) {
        if (!person) return "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a";
        return person.full_name || person.farm_name || person.email || "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a";
    }
    function ComplaintChatBubble({ message, isOwn, isInitial }) {
        const sender = message.sender || {};
        const authorName = complaintParticipantName(sender);
        const roleLabel = isInitial ? "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435" : (roleText(message.sender_role) || "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a");
        return h("div", {
            className: `react-chat-bubble-row${isOwn ? " is-own" : ""}${isInitial ? " is-initial" : ""}`
        }, [
            h("div", { className: "react-chat-bubble" }, [
                h("div", { className: "react-chat-bubble-meta" }, [
                    h("span", { className: "react-chat-bubble-author" }, authorName),
                    h("span", { className: "react-chat-bubble-role" }, roleLabel),
                    h("time", { className: "react-chat-bubble-time" }, dateTimeText(message.created_at) || dateText(message.created_at) || "")
                ]),
                message.text ? h("p", { className: "react-chat-bubble-text" }, message.text) : null,
                message.attachment_path ? A({ href: message.attachment_path, target: "_blank", className: "react-chat-attachment" }, "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0432\u043b\u043e\u0436\u0435\u043d\u0438\u0435") : null
            ])
        ]);
    }
    function ComplaintChatPanel({ complaint, author, conversation, messages, canReply, replyPlaceholder, emptyText, showAttachment }) {
        const threadRef = React.useRef(null);
        const currentUserId = user && user.id;
        const complaintText = String(complaint.text || complaint.description || "").trim();
        const hasInitialInThread = complaintText && (messages || []).some(item => String(item.text || "").trim() === complaintText);
        const threadItems = [];
        if (complaintText && !hasInitialInThread) {
            threadItems.push({
                id: `initial-${complaint.id}`,
                sender: author,
                sender_role: "user",
                sender_id: complaint.user_id,
                text: complaintText,
                created_at: complaint.created_at,
                attachment_path: complaint.attachment_path,
                is_initial: true
            });
        }
        threadItems.push(...(messages || []));
        React.useEffect(() => {
            const node = threadRef.current;
            if (node) node.scrollTop = node.scrollHeight;
        }, [threadItems.length, complaint.id]);
        const composeForm = canReply && conversation.id ? h("form", {
            action: `/conversations/${conversation.id}/message`,
            method: "post",
            encType: "multipart/form-data",
            className: "react-chat-compose",
            onSubmit: handleSubmitOnce
        }, [
            Textarea({
                name: "text",
                placeholder: replyPlaceholder || "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043e\u0442\u0432\u0435\u0442 \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044e\u2026",
                className: "wide react-chat-compose-input",
                rows: 3,
                required: true,
                maxLength: 2000
            }),
            h("div", { className: "react-chat-compose-toolbar" }, [
                showAttachment !== false ? h("label", { className: "react-chat-attach-btn" }, [
                    h("input", { type: "file", name: "attachment", accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt", className: "react-chat-attach-input" }),
                    "\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u0435"
                ]) : h("span", null),
                h("button", { className: "react-btn", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c")
            ])
        ]) : null;
        return h("div", { className: "react-chat-window" }, [
            h("div", { className: "react-chat-window-head" }, [
                h("div", null, [
                    h("h2", null, "\u041f\u0435\u0440\u0435\u043f\u0438\u0441\u043a\u0430"),
                    h("p", { className: "react-muted" }, canReply && user && (user.role === "admin" || user.role === "manager")
                        ? "\u041e\u0442\u0432\u0435\u0442 \u0443\u0432\u0438\u0434\u0438\u0442 \u0430\u0432\u0442\u043e\u0440 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f"
                        : "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044e")
                ]),
                complaint.status ? h(StatusChip, { value: complaint.status, label: complaintStatusText(complaint.status) }) : null
            ]),
            h("div", {
                ref: threadRef,
                className: "react-chat-thread",
                role: "log",
                "aria-live": "polite",
                "aria-label": "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u043f\u043e \u0436\u0430\u043b\u043e\u0431\u0435"
            }, threadItems.length ? threadItems.map(message => {
                const isOwn = message.sender_id === currentUserId;
                return h(ComplaintChatBubble, { key: message.id, message, isOwn, isInitial: message.is_initial });
            }) : h("div", { className: "react-chat-thread-empty" }, emptyText || "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442. \u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043f\u0435\u0440\u0432\u044b\u0439 \u043e\u0442\u0432\u0435\u0442.")),
            composeForm
        ]);
    }
    function ComplaintDetailPage2() {
        const complaint = props.complaint || {};
        const order = props.order || {};
        const conversation = props.conversation || {};
        const messages = props.messages || [];
        const author = props.author || {};
        const targetUser = props.target_user || {};
        const targetProduct = props.target_product || {};
        const canAdmin = user && (user.role === "admin" || user.role === "manager");
        const recipientLabel = complaint.assigned_to_role === "accountant" ? "\u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440" : "\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b";
        return h("section", { className: "react-complaint-detail" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, `\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435 #${complaint.id || ""}`),
                    h("p", { className: "react-muted" }, COMPLAINT_CATEGORY_LABELS[complaint.category] || complaint.category || complaint.type || "-")
                ]),
                canAdmin
                    ? ButtonLink({ href: "/complaints/admin", className: "secondary" }, "\u041a \u0441\u043f\u0438\u0441\u043a\u0443")
                    : ButtonLink({ href: "/complaints/my", className: "secondary" }, "\u041a \u043c\u043e\u0438\u043c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f\u043c")
            ]),
            props.complaint_success && h("div", { className: "react-alert alert-success" }, props.complaint_success),
            props.complaint_error && h("div", { className: "react-alert alert-danger" }, props.complaint_error),
            h("div", { className: `react-complaint-detail-layout${canAdmin ? " with-sidebar" : ""}` }, [
                h("div", { className: "react-complaint-detail-main" }, [
                    h("div", { className: "react-complaint-summary" }, [
                        h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"), h(StatusChip, { value: complaint.status, label: complaintStatusText(complaint.status) })]),
                        h("div", { className: "react-card" }, [h("b", null, "\u0410\u0434\u0440\u0435\u0441\u0430\u0442"), h("p", null, recipientLabel)]),
                        h("div", { className: "react-card" }, [h("b", null, "\u0410\u0432\u0442\u043e\u0440"), h("p", null, complaintParticipantName(author))]),
                        complaint.order_id && h("div", { className: "react-card" }, [h("b", null, "\u0417\u0430\u043a\u0430\u0437"), h("p", null, orderDisplayNumber(order) || `#${complaint.order_id}`)]),
                        complaint.target_user_id && h("div", { className: "react-card" }, [h("b", null, "\u0424\u0435\u0440\u043c\u0435\u0440"), h("p", null, targetUser.farm_name || targetUser.full_name || targetUser.email || `#${complaint.target_user_id}`)]),
                        complaint.target_product_id && h("div", { className: "react-card" }, [h("b", null, "\u0422\u043e\u0432\u0430\u0440"), h("p", null, targetProduct.name || `#${complaint.target_product_id}`)])
                    ].filter(Boolean)),
                    h(ComplaintChatPanel, {
                        complaint,
                        author,
                        conversation,
                        messages,
                        canReply: props.can_reply,
                        replyPlaceholder: canAdmin ? "\u041e\u0442\u0432\u0435\u0442 \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u0430\u2026" : "\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435\u2026"
                    })
                ]),
                canAdmin && h("aside", { className: "react-complaint-detail-sidebar" }, [
                    h("div", { className: "react-panel react-complaint-side-card" }, [
                        h("h2", null, "\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430"),
                        h("p", { className: "react-muted" }, "\u0421\u043c\u0435\u043d\u0430 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u0438 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043f\u0440\u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0438 \u0442\u0430\u043a\u0436\u0435 \u043f\u043e\u043f\u0430\u0434\u0443\u0442 \u0432 \u0447\u0430\u0442."),
                        props.can_status && h("form", {
                            action: `/complaints/admin/${complaint.id}/status`,
                            method: "post",
                            className: "react-complaint-side-form",
                            onSubmit: handleSubmitOnce
                        }, [
                            h("label", { className: "react-field-label" }, "\u0421\u0442\u0430\u0442\u0443\u0441"),
                            Select({ name: "status", defaultValue: complaint.status }, COMPLAINT_STATUS_OPTIONS.map(status => h("option", { key: status, value: status }, complaintStatusText(status)))),
                            h("label", { className: "react-field-label" }, "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043f\u0440\u0438 \u0441\u043c\u0435\u043d\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u0430"),
                            Textarea({
                                name: "response_text",
                                placeholder: "\u041d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e",
                                className: "wide",
                                rows: 4,
                                maxLength: 2000
                            }),
                            h("button", { className: "react-btn wide", type: "submit" }, "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441")
                        ]),
                        props.can_transfer && h("div", { className: "react-complaint-side-actions" }, [
                            PostButton({
                                action: `/complaints/admin/${complaint.id}/transfer`,
                                children: "\u041f\u0435\u0440\u0435\u0434\u0430\u0442\u044c \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0443",
                                className: "react-btn secondary wide"
                            })
                        ])
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
            h("form", { action: "/seller/support/create", method: "post", encType: "multipart/form-data", className: "react-form-grid", onSubmit: handleSubmitOnce }, [
                Select({ name: "topic", defaultValue: "other" }, [
                    h("option", { value: "moderation" }, "\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f \u043f\u0440\u043e\u0444\u0438\u043b\u044f/\u0442\u043e\u0432\u0430\u0440\u0430"),
                    h("option", { value: "documents" }, "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430"),
                    h("option", { value: "certificates" }, "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u044b"),
                    h("option", { value: "block" }, "\u0411\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u043a\u0430"),
                    h("option", { value: "commission" }, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b"),
                    h("option", { value: "other" }, "\u0414\u0440\u0443\u0433\u043e\u0435")
                ]),
                Textarea({ name: "text", placeholder: "\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435", className: "wide", rows: 4, required: true, minLength: 10, maxLength: 2000 }),
                h("input", { name: "attachment", type: "file", className: "react-input wide", accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" }),
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
                        ticket.attachment_path && ButtonLink({ href: ticket.attachment_path, className: "secondary" }, "\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u0435"),
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
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u0442\u0430\u0442\u0443\u0441"), h(StatusChip, { value: complaint.status, label: complaintStatusText(complaint.status) })]),
                h("div", { className: "react-card" }, [h("b", null, "\u0417\u0430\u043a\u0430\u0437"), h("p", null, orderDisplayNumber(order) || complaint.order_id || "-")]),
                h("div", { className: "react-card" }, [h("b", null, "\u0421\u0443\u043c\u043c\u0430"), h("p", null, money(order.total_price || 0))]),
                h("div", { className: "react-card" }, [h("b", null, "\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f"), h("p", null, money(order.platform_fee || 0))])
            ]),
            h(ComplaintChatPanel, {
                complaint,
                author: complaint.author || props.author,
                conversation: props.conversation || {},
                messages,
                canReply: true,
                replyPlaceholder: "\u041e\u0442\u0432\u0435\u0442 \u0431\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440\u0430\u2026",
                showAttachment: false
            }),
            h("div", { className: "react-actions" }, [
                order.id ? PostButton({ action: `/accounting/orders/${order.id}/payout`, children: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0432\u044b\u043f\u043b\u0430\u0442\u0443" }) : null,
                order.id ? PostButton({ action: `/accounting/orders/${order.id}/refund`, children: "\u0412\u043e\u0437\u0432\u0440\u0430\u0442", className: "react-btn danger", confirmMessage: "\u0418\u043d\u0438\u0446\u0438\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u043e\u0437\u0432\u0440\u0430\u0442 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443?" }) : null
            ])
        ]);
    }
    function DeliveryTrackPage() {
        const delivery = props.delivery || {};
        const order = props.order || {};
        const steps = [
            { id: "waiting_payment", label: "Оплата" },
            { id: "waiting_assembly", label: "Сборка заказа" },
            { id: "accepted", label: "Принята логистикой" },
            { id: "in_transit", label: "В пути" },
            { id: "delivered", label: "Доставлена" }
        ];
        const stepOrder = {
            created: 0,
            waiting_payment: 1,
            waiting_assembly: 2,
            ready_for_delivery: 3,
            transferred_to_delivery: 3,
            accepted: 3,
            in_transit: 4,
            delivered: 5,
            cancelled: 0,
            manual: 3
        };
        const status = delivery.status || "created";
        const statusRank = stepOrder[status] || 0;
        const deliveryMethod = order.delivery_method || delivery.method || "";

        return h("section", { className: "react-panel react-stack" }, [
            h("div", { className: "react-page-title" }, [
                h("div", null, [
                    h("h1", null, "Отслеживание доставки"),
                    h("p", { className: "react-muted" }, `Заказ ${orderDisplayNumber(order)}`)
                ]),
                ButtonLink({ href: user && user.role === "seller" ? "/seller/orders" : "/order/orders", className: "secondary" }, "К заказам")
            ]),
            h("div", { className: "react-info-grid react-logistics-grid" }, [
                h("div", { className: "react-card react-logistics-card" }, [h("b", null, "Логистическая компания"), h(CdekDeliveryBadge, { method: deliveryMethod, provider: delivery.provider, trackNumber: delivery.track_number }), h("p", null, delivery.provider || "Служба доставки")]),
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
        const simplePages = {
            seller_pending: ["\u0417\u0430\u044f\u0432\u043a\u0430 \u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438", "\u0410\u0434\u043c\u0438\u043d \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u0442 \u0430\u043d\u043a\u0435\u0442\u0443 \u0444\u0435\u0440\u043c\u0435\u0440\u0430. \u041f\u043e\u0441\u043b\u0435 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u044f \u0432\u044b \u0441\u043c\u043e\u0436\u0435\u0442\u0435 \u0432\u043e\u0439\u0442\u0438 \u0438 \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0431\u0438\u043d\u0435\u0442 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430."],
            verify_email_sent: ["\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 email", "\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u043d\u0438\u0436\u0435."],
            verify_email_result: [props.success ? "Email \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d" : "\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f", props.message || ""]
        };
        const Head = (title, lead, kicker) => h("section", { className: "react-static-head" }, [
            kicker ? h("span", { className: "react-static-kicker" }, kicker) : null,
            h("h1", null, title),
            lead ? h("p", null, lead) : null
        ]);
        const List = (items, ordered) => h(ordered ? "ol" : "ul", { className: "react-static-list" }, items.map(item => h("li", { key: item }, item)));
        const Cards = (items, className) => h("section", { className: `react-static-grid ${className || ""}` }, items.map(item =>
            h("article", { key: item[0], className: "react-card react-static-card" }, [
                h("h2", null, item[0]),
                h("p", null, item[1])
            ])
        ));
        const pages = {
            about: () => h("div", { className: "react-static-page react-static-about" }, [
                Head("О сервисе «Свои Ряды»", "Это площадка для покупки фермерских продуктов напрямую у локальных продавцов. Покупатель видит, кто продает товар, что есть в наличии, как оформить заказ и где отслеживать доставку.", "О нас"),
                h("section", { className: "react-static-split" }, [
                    h("article", { className: "react-panel react-static-section" }, [
                        h("h2", null, "Что здесь главное"),
                        List(["Каталог состоит из товаров, которые прошли проверку и доступны к покупке.", "В карточке товара важны не лозунги, а цена, остаток, продавец, рейтинг и условия получения.", "После заказа покупатель может видеть статус, оплату, доставку и переписку по заказу в одном месте."])
                    ]),
                    h("aside", { className: "react-static-aside" }, [
                        h("b", null, "Принцип сервиса"),
                        h("p", null, "Меньше посредников и лишних обещаний. Больше понятной информации о продукте, продавце и заказе.")
                    ])
                ]),
                Cards([["Покупателям", "Быстрый поиск по продуктам, избранное, корзина, история заказов и отзывы после покупки."], ["Фермерам", "Заявка на подключение, личный кабинет продавца, управление товарами, заказами и документами."], ["Команде сервиса", "Модерация заявок, товаров и отзывов, поддержка клиентов, контроль спорных ситуаций."]])
            ]),
            delivery: () => h("div", { className: "react-static-page react-static-delivery" }, [
                Head("Доставка и самовывоз", "Способ получения выбирается при оформлении заказа. Итоговая сумма показывается до подтверждения, отдельно по товарам и доставке.", "Доставка"),
                h("section", { className: "react-static-price-list" }, [
                    h("article", null, [h("span", null, "Самовывоз"), h("b", null, "0 руб."), h("p", null, "Подходит, если заказ удобно забрать самостоятельно у продавца или из согласованной точки.")]),
                    h("article", null, [h("span", null, "Курьер"), h("b", null, "500 руб."), h("p", null, "Адрес, дата и интервал указываются в корзине. Стоимость добавляется к итоговой сумме заказа.")]),
                    h("article", null, [h("span", null, "Трекинг"), h("b", null, "после сборки"), h("p", null, "Когда заказ передан в доставку, появляется трек-номер и страница отслеживания.")])
                ]),
                h("section", { className: "react-panel react-static-section" }, [
                    h("h2", null, "Как проходит заказ"),
                    List(["Вы выбираете товары и способ получения в корзине.", "Продавец подтверждает заказ и собирает продукты.", "После передачи в доставку статус меняется, а у заказа появляется трек или пометка о самовывозе.", "Если что-то не сходится по адресу, оплате или качеству, можно написать в поддержку."], true)
                ]),
                h("section", { className: "react-static-note" }, [
                    h("b", null, "Важно"),
                    h("p", null, "Скоропортящиеся продукты лучше заказывать на ближайший удобный слот. Если заказ собирают несколько продавцов, условия получения могут отличаться.")
                ])
            ]),
            business: () => h("div", { className: "react-static-page react-static-business" }, [
                Head("Поставки для кафе, офисов и небольших магазинов", "Раздел для тех, кто покупает продукты не разово, а регулярно: на кухню, в офис или для локальной витрины.", "Для бизнеса"),
                Cards([["Кафе и кухни", "Овощи, молочные продукты, яйца, хлеб, мед, мясо и сезонные позиции от локальных продавцов."], ["Офисы", "Фрукты, выпечка, молочные продукты и наборы к чаю для регулярных закупок."], ["Небольшие магазины", "Проверенные товары с описанием, остатками, сертификатами и данными продавца."]], "react-static-grid-wide"),
                h("section", { className: "react-static-split" }, [
                    h("article", { className: "react-panel react-static-section" }, [
                        h("h2", null, "Что стоит согласовать заранее"),
                        List(["Периодичность поставок и минимальную сумму заказа.", "Нужные категории, объемы и сезонные замены.", "Документы, сертификаты и удобный формат оплаты."])
                    ]),
                    h("aside", { className: "react-static-aside" }, [
                        h("b", null, "Связь"),
                        h("p", null, "Для регулярных закупок проще начать с каталога, а детали согласовать с продавцом или поддержкой."),
                        ButtonLink({ href: "/catalog" }, "Открыть каталог")
                    ])
                ])
            ]),
            reviews: () => h("div", { className: "react-static-page react-static-compact" }, [
                Head("Отзывы", "Отзывы помогают выбирать продукты и продавцов без догадок. Оставить оценку можно после завершенного заказа.", "Клиентам"),
                h("section", { className: "react-panel react-static-section" }, [
                    h("h2", null, "Как это работает"),
                    List(["Покупатель оценивает товар: качество, свежесть, соответствие описанию.", "Отзывы проходят модерацию, чтобы убрать спам, оскорбления и нерелевантные сообщения.", "Рейтинг появляется в карточках товаров и помогает другим покупателям быстрее принимать решение."], true)
                ])
            ]),
            quality: () => h("div", { className: "react-static-page react-static-compact" }, [
                Head("Качество товаров", "На площадке важны проверяемые признаки: описание, документы, остаток, срок годности, отзывы и история продавца.", "Качество"),
                Cards([["Документы", "Продавец может добавить сертификаты и сведения о происхождении товара."], ["Модерация", "Новые товары и изменения проходят проверку перед публикацией."], ["Обратная связь", "Если товар приехал не таким, как ожидалось, покупатель может оставить отзыв или обращение в поддержку."]], "react-static-grid-wide"),
                h("section", { className: "react-static-note" }, [
                    h("b", null, "Что смотреть в карточке"),
                    h("p", null, "Цена, единица измерения, остаток, описание, продавец, рейтинг, срок годности и наличие сертификата.")
                ])
            ]),
            bonus: () => h("div", { className: "react-static-page react-static-compact" }, [
                Head("Бонусы и скидки", "Скидки показываются там, где они реально влияют на заказ: в карточке товара, каталоге и корзине.", "Бонусы"),
                h("section", { className: "react-panel react-static-section" }, [
                    h("h2", null, "Что может уменьшить сумму"),
                    List(["Скидочная цена на конкретный товар.", "Промокод, если он активен и подходит к условиям заказа.", "Итоговая сумма в корзине с учетом доставки и скидок."])
                ]),
                h("section", { className: "react-static-note" }, [h("p", null, "Если промокод не применяется, проверьте срок действия, минимальную сумму и товары в корзине.")])
            ]),
            recipes: () => h("div", { className: "react-static-page react-static-compact" }, [
                Head("Рецепты", "Здесь будут короткие подборки под сезонные продукты: без длинных статей, с понятным списком ингредиентов и ссылками на каталог.", "Рецепты"),
                Cards([["Овощи", "Салаты, рагу, запеканки и заготовки."], ["Фрукты и ягоды", "Завтраки, морсы, пироги и джемы."], ["Сыр, хлеб и молочные продукты", "Быстрые закуски и простые домашние ужины."]], "react-static-grid-wide")
            ]),
            blog: () => h("div", { className: "react-static-page react-static-compact" }, [
                Head("Блог", "Раздел для новостей сервиса, сезонных заметок и историй поставщиков. Пока он работает как аккуратная навигационная страница.", "Блог"),
                h("section", { className: "react-panel react-static-section" }, [
                    h("h2", null, "Что здесь уместно"),
                    List(["Короткие новости о новых продавцах и категориях.", "Сезонные подсказки: что сейчас свежее и выгоднее брать.", "Практичные заметки о хранении, выборе и приготовлении продуктов."])
                ])
            ])
        };
        if (!pages[page]) {
            const content = simplePages[page] || ["\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430", "\u0420\u0430\u0437\u0434\u0435\u043b \u043f\u0435\u0440\u0435\u0432\u0435\u0434\u0435\u043d \u043d\u0430 React."];
            if (page === "verify_email_sent") {
                const verificationLink = props.verification_link || props.verification_demo_link || "";
                const mailSent = props.verification_mail_sent !== false;
                return h("section", { className: "react-panel" }, [
                    h("h1", null, content[0]),
                    h("p", null, mailSent
                        ? "\u041c\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043f\u0438\u0441\u044c\u043c\u043e \u0441 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435\u043c \u043d\u0430 \u0432\u0430\u0448 email. \u041f\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435 \u0438\u0437 \u043f\u0438\u0441\u044c\u043c\u0430 \u0438\u043b\u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u043a\u043d\u043e\u043f\u043a\u0443 \u043d\u0438\u0436\u0435."
                        : "\u041f\u0438\u0441\u044c\u043c\u043e \u043d\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438. \u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0438\u0436\u0435 \u0438\u043b\u0438 \u0437\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u0443\u044e \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0443."),
                    !mailSent && verificationLink ? h("p", { className: "react-muted" }, "\u0414\u043b\u044f \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e\u0439 \u0441\u0440\u0435\u0434\u044b SMTP \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u0441\u0441\u044b\u043b\u043a\u0430 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0430 \u043d\u0438\u0436\u0435.") : null,
                    verificationLink ? ButtonLink({ href: verificationLink }, "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c email") : null,
                    h("form", { action: "/verify-email/resend", method: "post", className: "react-inline-form", style: { marginTop: 12 }, onSubmit: handleSubmitOnce }, [
                        h("button", { className: "react-btn secondary", type: "submit" }, "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e")
                    ]),
                    h("div", { style: { marginTop: 18 } }, ButtonLink({ href: "/cart/", className: "secondary" }, "\u0412 \u043a\u043e\u0440\u0437\u0438\u043d\u0443"))
                ]);
            }
            return h("section", { className: "react-panel" }, [h("h1", null, content[0]), content.slice(1).map((p, i) => h("p", { key: i }, p)), props.verification_link && ButtonLink({ href: props.verification_link }, "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c email"), h("div", { style: { marginTop: 18 } }, ButtonLink({ href: "/", className: "secondary" }, "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e"))]);
        }
        return pages[page]();
    }
    function GenericPage() {
        return h("section", { className: "react-panel" }, [h("h1", null, "\u0420\u0430\u0437\u0434\u0435\u043b"), h("p", null, "\u0418\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u044d\u0442\u043e\u0439 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0447\u0435\u0440\u0435\u0437 \u043e\u0431\u0449\u0438\u0439 React-\u043a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442."), h("pre", { style: { whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto" } }, JSON.stringify(props, null, 2))]);
    }
    function NullPage() {
        return null;
    }
    const pageMap = {
        index: HomePage,
        catalog: CatalogPage,
        search: CatalogPage,
        favorites: CatalogPage,
        product: ProductPage,
        login: NullPage,
        forgot_password: NullPage,
        forgot_password_sent: NullPage,
        reset_password: NullPage,
        register: NullPage,
        become_seller: NullPage,
        cart: CartPage,
        seller: SellerPage,
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
        backups: BackupsPage,
        admin: AdminManagePage,
        admin_finance: AdminFinancePage,
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
        const [authView, setAuthView] = React.useState(authRouteSet.has(page) ? page : null);
        const [noticeMessage, setNoticeMessage] = React.useState(props.notice_message || "");
        const onLogoutRequest = React.useCallback(event => {
            if (event) event.preventDefault();
            setLogoutConfirm({ href: "/logout" });
        }, []);
        const onLoginRequest = React.useCallback(event => {
            if (event) event.preventDefault();
            setAuthView("login");
        }, []);
        const onBecomeSellerRequest = React.useCallback(event => {
            if (event) event.preventDefault();
            setAuthView("become_seller");
        }, []);
        React.useEffect(() => {
            const openInlineAuth = event => {
                setAuthView((event && event.detail && event.detail.view) || "login");
            };
            window.addEventListener("react:auth-required", openInlineAuth);
            return () => window.removeEventListener("react:auth-required", openInlineAuth);
        }, []);
        const closeLogoutConfirm = React.useCallback(() => {
            setLogoutConfirm(null);
        }, []);
        const closeAuth = React.useCallback(() => {
            if (authRouteSet.has(page)) {
                window.location.assign("/");
                return;
            }
            setAuthView(null);
        }, []);
        const switchAuth = React.useCallback(view => {
            setAuthView(view);
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
            onLoginRequest,
            logoutConfirm,
            closeLogoutConfirm,
            confirmLogout,
            authView,
            closeAuth,
            switchAuth,
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
