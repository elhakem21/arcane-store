const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// مفاتيح الإعدادات الحساسة مخفية في السيرفر بالكامل
const HEVO_TEAM_API_KEY = "YOUR_SECRET_HEVO_TOKEN";
const HEVO_API_URL = "https://hevoteam.com/api/v2"; 
let USD_TO_EGP_RATE = 48.50; // يمكن تحديثه عبر API بنكي أو لوحة التحكم

// قاعدة بيانات محلية كمثال (في الإنتاج تُربط بـ MySQL أو Supabase)
let db_users = [
    { id: "u1", realName: "mwix", type: "ثلاثي", price_usd: 1.50, sold: false },
    { id: "u2", realName: "68t6", type: "رباعي", price_usd: 2.10, sold: false },
    { id: "u3", realName: "X_R_7", type: "ثلاثي", price_usd: 1.80, sold: false },
    { id: "u4", realName: "K_K_0_K", type: "رباعي", price_usd: 1.10, sold: false },
    { id: "u5", realName: "Z55ZZ", type: "خماسي", price_usd: 0.50, sold: false }
];

let orders_history = [];

// 1. جلب المنتجات بشكل آمن (مع إخفاء الاسم الحقيقي لليوزر لحمايته قبل الشراء)
app.get('/api/products', (req, res) => {
    const safeUsers = db_users.filter(u => !u.sold).map(u => ({
        id: u.id,
        type: u.type,
        price_usd: u.price_usd,
        // قناع لحماية اليوزر في الواجهة
        maskedName: u.realName[0] + "*".repeat(u.realName.length - 2) + u.realName[u.realName.length - 1]
    }));
    res.json({ users: safeUsers, rate: USD_TO_EGP_RATE });
});

// 2. إنشاء طلب جديد (حالة معلقة بانتظار مراجعة المسؤول أو نظام الكاش الآلي)
app.post('/api/orders/create', (req, res) => {
    const { productId, userWallet, method } = req.body;
    const product = db_users.find(u => u.id === productId && !u.sold);
    
    if (!product) return res.status(404).json({ error: "المنتج غير متوفر أو تم بيعه مسبقاً" });

    const newOrder = {
        orderId: "ORD_" + Date.now(),
        productId: product.id,
        productName: product.type + " (مخفي)",
        amount_egp: (product.price_usd * USD_TO_EGP_RATE).toFixed(2),
        userWallet: userWallet,
        method: method,
        status: "pending", // لا يتم التسليم إلا بعد التغيير إلى approved
        deliveryData: null
    };

    orders_history.push(newOrder);
    res.json({ success: true, message: "تم تسجيل طلبك بنجاح، بانتظار التأكيد المالي.", orderId: newOrder.orderId });
});

// 3. لوحة التحكم الآمنة: تأكيد الدفع وتسليم المنتج (لا يمكن للعميل الوصول لها)
app.post('/api/admin/approve-order', (req, res) => {
    const { orderId, adminToken } = req.body;
    if (adminToken !== "SUPER_SECRET_ADMIN_PASSWORD") return res.status(403).json({ error: "غير مصرح لك" });

    const order = orders_history.find(o => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });

    const product = db_users.find(u => u.id === order.productId);
    if (product) {
        product.sold = true; // علامة البيع في السيرفر
        order.status = "completed";
        order.deliveryData = `@${product.realName}`; // هنا فقط يخرج اليوزر الحقيقي للواجهة
        return res.json({ success: true, deliveryData: order.deliveryData });
    }
    
    res.status(400).json({ error: "فشل في معالجة المنتج" });
});

app.listen(PORT, () => console.log(`السيرفر الآمن يعمل على منفذ ${PORT}`));
