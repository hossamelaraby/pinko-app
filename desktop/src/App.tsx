import React, { useState, useEffect } from 'react';
import {
  SupabaseService,
  ROLE_PASSWORDS,
  getActiveSupabaseUrl,
  getActiveSupabaseKey,
  reinitSupabaseClient,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_KEY
} from './services/supabaseService';
import {
  Crown,
  Building2,
  Truck,
  ShoppingCart,
  Boxes,
  BarChart3,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  RefreshCw,
  LogOut,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  MapPin,
  Calendar,
  CreditCard,
  Layers,
  ChevronDown,
  Edit,
  Save,
  X,
  FileText,
  Settings,
  ExternalLink,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';

interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Product {
  id: string;
  name_ar: string;
  sku: string;
  category_id: string;
  category_name?: string;
  cost_price_piastres: number;
  retail_price_piastres: number;
  carton_ratio: number;
  on_hand_base: number;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPriceEGP: number;
}

interface SaleRecord {
  id: string;
  invoice_number: string;
  created_at: string;
  total_piastres: number;
  paid_cash_piastres: number;
  on_credit_piastres: number;
  notes?: string;
  customers?: { name: string; address?: string };
  locations?: { name: string };
  users?: { full_name: string };
  sale_items?: any[];
}

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'branch' | 'vehicle' | null>(null);
  const [branchChoice, setBranchChoice] = useState<'shop1_warehouse1' | 'shop2_warehouse2'>('shop1_warehouse1');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Active view
  const [activeTab, setActiveTab] = useState<'pos' | 'warehouse' | 'reports' | 'vehicle'>('pos');
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // App Master Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [productSearch, setProductSearch] = useState<string>('');

  // Owner branch filter for POS / Warehouse / Reports
  const [activeBranchId, setActiveBranchId] = useState<string>('');

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [paidCashEGP, setPaidCashEGP] = useState<string>('');
  const [discountEGP, setDiscountEGP] = useState<string>('0');
  const [printReceiptModal, setPrintReceiptModal] = useState<SaleRecord | null>(null);

  // Warehouse Inbound State
  const [inboundCategoryName, setInboundCategoryName] = useState<string>('');
  const [inboundProductName, setInboundProductName] = useState<string>('');
  const [inboundSku, setInboundSku] = useState<string>('');
  const [inboundCartonQty, setInboundCartonQty] = useState<number>(10);
  const [inboundPiecesPerCarton, setInboundPiecesPerCarton] = useState<number>(20);
  const [inboundCartonCostEGP, setInboundCartonCostEGP] = useState<string>('120');
  const [inboundPieceRetailEGP, setInboundPieceRetailEGP] = useState<string>('8');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Reports State
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [reportBranchFilter, setReportBranchFilter] = useState<'all' | 'shop1' | 'shop2'>('all');
  const [reportData, setReportData] = useState<{
    totalRevenue: number;
    totalCash: number;
    totalCredit: number;
    totalProfit: number;
    productSales: any[];
    sales: SaleRecord[];
  }>({
    totalRevenue: 0,
    totalCash: 0,
    totalCredit: 0,
    totalProfit: 0,
    productSales: [],
    sales: []
  });

  // Debt Settlement Modal
  const [settleDebtModal, setSettleDebtModal] = useState<SaleRecord | null>(null);
  const [settleAmountEGP, setSettleAmountEGP] = useState<string>('');

  // Sale Management Modals for Owner (حذف وتعديل الفواتير)
  const [editingSaleModal, setEditingSaleModal] = useState<SaleRecord | null>(null);
  const [editSaleCashEGP, setEditSaleCashEGP] = useState<string>('');
  const [editSaleCreditEGP, setEditSaleCreditEGP] = useState<string>('');
  const [editSaleNotes, setEditSaleNotes] = useState<string>('');

  // Vehicle Fleet State
  const [vehiclePeriod, setVehiclePeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [vehicleStops, setVehicleStops] = useState<any[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<any[]>([]);
  const [stopShopName, setStopShopName] = useState('');
  const [stopSelectedCatId, setStopSelectedCatId] = useState('');
  const [stopSelectedProdId, setStopSelectedProdId] = useState('');
  const [stopItemName, setStopItemName] = useState('');
  const [stopItemPriceEGP, setStopItemPriceEGP] = useState('');
  const [stopItemQty, setStopItemQty] = useState(1);
  const [stopCollectedEGP, setStopCollectedEGP] = useState('');
  const [stopRemainingEGP, setStopRemainingEGP] = useState('');
  const [expAmountEGP, setExpAmountEGP] = useState('');
  const [expReason, setExpReason] = useState('');

  // Time & Clock
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString('ar-EG'));

  // Cloud Health & Project Settings State
  const [isCloudOnline, setIsCloudOnline] = useState<boolean | null>(null);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string>('');
  const [showCloudSettingsModal, setShowCloudSettingsModal] = useState<boolean>(false);
  const [customSupabaseUrl, setCustomSupabaseUrl] = useState<string>(getActiveSupabaseUrl());
  const [customSupabaseKey, setCustomSupabaseKey] = useState<string>(getActiveSupabaseKey());
  const [isCheckingCloud, setIsCheckingCloud] = useState<boolean>(false);

  const checkCloudHealthStatus = async () => {
    setIsCheckingCloud(true);
    const res = await SupabaseService.checkCloudHealth();
    setIsCloudOnline(res.online);
    setCloudStatusMsg(res.message || '');
    setIsCheckingCloud(false);
    return res;
  };

  useEffect(() => {
    checkCloudHealthStatus();
  }, []);

  const handleSaveCloudSettings = async () => {
    reinitSupabaseClient(customSupabaseUrl, customSupabaseKey);
    const res = await checkCloudHealthStatus();
    if (res.online) {
      setAlertMsg({ text: 'تم الاتصال بالسحابة بنجاح! تم حفظ وتفعيل إعدادات الربط.', type: 'success' });
      if (currentUser) {
        loadLocations();
        loadCategories();
        loadProducts(activeBranchId);
      }
    } else {
      setAlertMsg({ text: 'تنبيه: لا يزال الاتصال معطلاً. يرجى التأكد من استئناف المشروع في Supabase أو صحة البيانات.', type: 'error' });
    }
  };

  const handleResetCloudSettings = async () => {
    setCustomSupabaseUrl(DEFAULT_SUPABASE_URL);
    setCustomSupabaseKey(DEFAULT_SUPABASE_KEY);
    reinitSupabaseClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
    await checkCloudHealthStatus();
    setAlertMsg({ text: 'تمت استعادة الإعدادات الافتراضية للربط السحابي.', type: 'info' });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial Master Data once logged in
  useEffect(() => {
    if (currentUser) {
      loadLocations();
      loadCategories();
    }
  }, [currentUser]);

  // Sync Products when branch changes
  useEffect(() => {
    if (currentUser && activeBranchId) {
      loadProducts(activeBranchId);
    }
  }, [currentUser, activeBranchId]);

  // Sync Reports when report tab or filters change
  useEffect(() => {
    if (currentUser && (activeTab === 'reports' || (currentUser.role === 'shop_manager' && activeTab === 'pos'))) {
      loadReports();
    }
  }, [currentUser, activeTab, reportPeriod, reportBranchFilter, activeBranchId]);

  // Sync Vehicle Data
  useEffect(() => {
    if (currentUser && (activeTab === 'vehicle' || currentUser.role === 'driver')) {
      loadVehicleData(vehiclePeriod);
    }
  }, [currentUser, activeTab, vehiclePeriod]);

  // Keyboard Shortcuts (Desktop standard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentUser) return;
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('pos');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('warehouse');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('reports');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('vehicle');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  // Data Loaders using Direct Cloud Supabase Service
  const loadLocations = async () => {
    try {
      const locs: any = await SupabaseService.getLocations();
      setLocations(locs);
      const defaultBranch = locs.find((l: any) => l.code === 'shop1_warehouse1') || locs[0];
      if (currentUser?.role === 'owner') {
        if (defaultBranch && !activeBranchId) setActiveBranchId(defaultBranch.id);
      } else if (currentUser?.assigned_location_id) {
        setActiveBranchId(currentUser.assigned_location_id);
      } else if (defaultBranch && !activeBranchId) {
        setActiveBranchId(defaultBranch.id);
      }
    } catch (e: any) {
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  const loadCategories = async () => {
    try {
      const cats: any = await SupabaseService.getCategories();
      setCategories(cats);
    } catch (e: any) {
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  const loadProducts = async (locationId?: string) => {
    try {
      setLoading(true);
      const targetLocId = locationId || activeBranchId || locations[0]?.id || 'shop1_warehouse1';
      const prods: any = await SupabaseService.getProducts(targetLocId);
      setProducts(prods);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  const loadReports = async () => {
    try {
      let locId: string | undefined = undefined;
      if (currentUser?.role === 'owner') {
        if (reportBranchFilter === 'shop1') {
          const s1 = locations.find(l => l.code === 'shop1_warehouse1');
          if (s1) locId = s1.id;
        } else if (reportBranchFilter === 'shop2') {
          const s2 = locations.find(l => l.code === 'shop2_warehouse2');
          if (s2) locId = s2.id;
        }
      } else {
        locId = activeBranchId;
      }

      const data = await SupabaseService.getSalesReport(reportPeriod, locId);
      setReportData({
        totalRevenue: (data.totalRevenuePiastres || 0) / 100,
        totalCash: (data.totalCashPiastres || 0) / 100,
        totalCredit: (data.totalCreditPiastres || 0) / 100,
        totalProfit: (data.totalProfitPiastres || 0) / 100,
        productSales: data.productSales || [],
        sales: data.sales || []
      });
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadVehicleData = async (period: 'daily' | 'monthly' | 'yearly') => {
    try {
      const stops = await SupabaseService.getVehicleStops(period);
      const expenses = await SupabaseService.getVehicleExpenses(period);
      setVehicleStops(stops);
      setVehicleExpenses(expenses);
    } catch (e: any) {
      console.error(e);
    }
  };

  // -------------------------------------------------------------
  // LOGIN LOGIC (Cloud Direct Authentication)
  // -------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      if (!selectedRole) {
        throw new Error('يرجى اختيار الحساب المطلوب');
      }

      const user = await SupabaseService.login(selectedRole, branchChoice, passwordInput);
      setCurrentUser(user);

      if (user.role === 'driver') {
        setActiveTab('vehicle');
      } else {
        setActiveTab('pos');
      }
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setLoginError(err.message || 'فشل تسجيل الدخول، تأكد من كلمة المرور');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedRole(null);
    setPasswordInput('');
    setCart([]);
  };

  // -------------------------------------------------------------
  // POS CART ACTIONS
  // -------------------------------------------------------------
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        unitPriceEGP: product.retail_price_piastres / 100
      }]);
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setPaidCashEGP('');
    setDiscountEGP('0');
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPriceEGP), 0);
  const discountVal = parseFloat(discountEGP) || 0;
  const cartTotal = Math.max(0, cartSubtotal - discountVal);
  const enteredCash = parseFloat(paidCashEGP) || 0;
  const computedCredit = Math.max(0, cartTotal - enteredCash);

  // Submit POS Sale
  const handleCheckout = async (andPrint = false) => {
    if (cart.length === 0) {
      setAlertMsg({ text: 'السلة فارغة! اختر منتجات للبيع أولاً', type: 'error' });
      return;
    }

    const targetLocId = activeBranchId || locations[0]?.id || 'shop1_warehouse1';

    try {
      setLoading(true);
      const idempotencyKey = `pos-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const payload = {
        locationId: targetLocId,
        cashierId: currentUser.id,
        customerName: customerName.trim() || undefined,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPricePiastres: Math.round(item.unitPriceEGP * 100)
        })),
        discountPiastres: Math.round(discountVal * 100),
        paidCashPiastres: Math.round(enteredCash * 100),
        onCreditPiastres: Math.round(computedCredit * 100),
        notes: `فاتورة كاشير - بيع مباشر للعميل (${customerName || 'عميل نقدي'})`,
        idempotencyKey
      };

      const sale = await SupabaseService.commitSale(payload);

      setAlertMsg({
        text: `تم حفظ الفاتورة بنجاح في السحابة (${sale.invoice_number}) بمبلغ ${cartTotal.toFixed(2)} ج.م`,
        type: 'success'
      });

      if (andPrint) {
        setPrintReceiptModal({
          ...sale,
          locations: { name: locations.find(l => l.id === targetLocId)?.name || 'الفرع' },
          users: { full_name: currentUser.full_name }
        });
      }

      clearCart();
      loadProducts(targetLocId);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // WAREHOUSE INBOUND LOGIC
  // -------------------------------------------------------------
  const handleInboundStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundProductName.trim()) {
      setAlertMsg({ text: 'يرجى كتابة اسم المنتج', type: 'error' });
      return;
    }

    const targetLocId = activeBranchId || locations[0]?.id || 'shop1_warehouse1';

    try {
      setLoading(true);
      await SupabaseService.inboundGoods({
        locationId: targetLocId,
        categoryName: inboundCategoryName.trim() || 'شوكولاتات',
        name_ar: inboundProductName.trim(),
        cartonQty: inboundCartonQty,
        piecesPerCarton: inboundPiecesPerCarton,
        cartonCostEGP: parseFloat(inboundCartonCostEGP) || 0,
        pieceRetailEGP: parseFloat(inboundPieceRetailEGP) || 0,
        actorId: currentUser.id
      });

      setAlertMsg({
        text: `تم توريد واستلام ${inboundCartonQty * inboundPiecesPerCarton} عبوة في المخزن السحابي بنجاح`,
        type: 'success'
      });

      setInboundProductName('');
      setInboundSku('');
      loadProducts(targetLocId);
      loadCategories();
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    try {
      setLoading(true);
      await SupabaseService.updateProduct(editingProduct.id, {
        locationId: activeBranchId,
        retail_price_piastres: editingProduct.retail_price_piastres,
        cost_price_piastres: editingProduct.cost_price_piastres,
        on_hand_base: editingProduct.on_hand_base
      });
      setAlertMsg({ text: `تم تحديث المنتج (${editingProduct.name_ar}) بنجاح`, type: 'success' });
      setEditingProduct(null);
      loadProducts(activeBranchId);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الصنف (${productName}) نهائياً من المخزن وقاعدة البيانات السحابية؟`)) {
      return;
    }
    try {
      setLoading(true);
      await SupabaseService.deleteProduct(productId);
      setAlertMsg({
        text: `تم حذف الصنف (${productName}) ورصيده المخزني بنجاح من السحابة`,
        type: 'success'
      });
      if (activeBranchId) await loadProducts(activeBranchId);
      await loadCategories();
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message || 'فشل حذف الصنف', type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // DEBT SETTLEMENT LOGIC
  // -------------------------------------------------------------
  const handleSettleDebt = async () => {
    if (!settleDebtModal) return;
    const amountNum = parseFloat(settleAmountEGP);
    if (isNaN(amountNum) || amountNum <= 0) {
      setAlertMsg({ text: 'يرجى إدخال مبلغ صحيح للسداد', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      const amountPiastres = Math.round(amountNum * 100);
      await SupabaseService.settleDebt(settleDebtModal.id, amountPiastres, currentUser.id);

      setAlertMsg({
        text: `تم سداد ${amountNum} ج.م بنجاح وتحديث السحابة تلقائياً`,
        type: 'success'
      });

      setSettleDebtModal(null);
      setSettleAmountEGP('');
      loadReports();
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // OWNER SALE MANAGEMENT: DELETE & EDIT (صلاحية كاملة للمالك)
  // -------------------------------------------------------------
  const handleDeleteSale = async (saleId: string, invoiceNumber: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف وإلغاء الفاتورة (${invoiceNumber}) كـ "مرتجع مبيعات"؟\nسيتم فوراً إرجاع جميع الأصناف المباعة إلى رصيد المخزن في السحابة، وتعديل إجمالي المبيعات وخصم أي آجل مسجل عليها.`)) {
      return;
    }

    try {
      setLoading(true);
      await SupabaseService.deleteSale(saleId, currentUser.id);
      setAlertMsg({
        text: `تم حذف الفاتورة (${invoiceNumber}) بنجاح كمرتجع مبيعات واسترجاع البضاعة وتحديث السحابة فوراً`,
        type: 'success'
      });
      await loadReports();
      if (activeBranchId) await loadProducts(activeBranchId);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  const handleOpenEditSaleModal = (sale: SaleRecord) => {
    setEditingSaleModal(sale);
    setEditSaleCashEGP(((sale.paid_cash_piastres || 0) / 100).toString());
    setEditSaleCreditEGP(((sale.on_credit_piastres || 0) / 100).toString());
    setEditSaleNotes(sale.notes || '');
  };

  const handleSaveSaleEdit = async () => {
    if (!editingSaleModal) return;
    try {
      setLoading(true);
      const cashVal = parseFloat(editSaleCashEGP) || 0;
      const creditVal = parseFloat(editSaleCreditEGP) || 0;
      await SupabaseService.updateSale(editingSaleModal.id, {
        paidCashPiastres: Math.round(cashVal * 100),
        onCreditPiastres: Math.round(creditVal * 100),
        notes: editSaleNotes.trim()
      });

      setAlertMsg({
        text: `تم حفظ تعديلات الفاتورة (${editingSaleModal.invoice_number}) بنجاح بالسحابة`,
        type: 'success'
      });
      setEditingSaleModal(null);
      await loadReports();
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // VEHICLE FLEET LOGIC
  // -------------------------------------------------------------
  const handleRecordVehicleStop = async () => {
    if (!stopShopName.trim()) {
      setAlertMsg({ text: 'يرجى كتابة اسم المحل أو العميل', type: 'error' });
      return;
    }
    const finalItemName = stopItemName || (products.find(p => p.id === stopSelectedProdId)?.name_ar) || 'صنف حلويات';
    const priceNum = parseFloat(stopItemPriceEGP);
    if (isNaN(priceNum) || priceNum <= 0) {
      setAlertMsg({ text: 'يرجى تحديد سعر البيع', type: 'error' });
      return;
    }

    if (stopCollectedEGP === '' && stopRemainingEGP === '') {
      setAlertMsg({ text: 'شرط إلزامي: يجب إدخال المبلغ المحصل نقداً أو المتبقي الآجل قبل الحفظ بالسحابة!', type: 'error' });
      return;
    }

    const collectedNum = parseFloat(stopCollectedEGP || '0');
    const remainingNum = parseFloat(stopRemainingEGP || '0');

    try {
      setLoading(true);
      const idempotencyKey = `veh-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const targetLoc = locations.find(l => l.type === 'vehicle')?.id || activeBranchId;

      await SupabaseService.commitSale({
        locationId: targetLoc,
        cashierId: currentUser.id,
        customerName: stopShopName.trim(),
        items: [{
          productId: stopSelectedProdId || products[0]?.id || 'veh-prod',
          quantity: stopItemQty,
          unitPricePiastres: Math.round(priceNum * 100)
        }],
        paidCashPiastres: Math.round(collectedNum * 100),
        onCreditPiastres: Math.round(remainingNum * 100),
        notes: `تسليم محطة: ${stopShopName} (${finalItemName})`,
        idempotencyKey
      });

      setAlertMsg({
        text: `تم تسليم المحطة للمحل (${stopShopName}) وتوثيقها في السحابة بنجاح`,
        type: 'success'
      });

      setStopShopName('');
      setStopItemName('');
      setStopItemPriceEGP('');
      setStopCollectedEGP('');
      setStopRemainingEGP('');
      setStopItemQty(1);
      loadVehicleData(vehiclePeriod);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  const handleRecordVehicleExpense = async () => {
    const amountNum = parseFloat(expAmountEGP);
    if (isNaN(amountNum) || amountNum <= 0) {
      setAlertMsg({ text: 'يرجى إدخال مبلغ المصروف', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      await SupabaseService.recordVehicleExpense(
        Math.round(amountNum * 100),
        expReason.trim() || 'مصاريف سيارة التوزيع (بنزين/صيانة)',
        currentUser.id
      );

      setAlertMsg({ text: `تم تسجيل مصروف ${amountNum} ج.م في السحابة بنجاح`, type: 'success' });
      setExpAmountEGP('');
      setExpReason('');
      loadVehicleData(vehiclePeriod);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // Calculations for Vehicle
  const totalVehicleCash = vehicleStops.reduce((sum, s) => sum + (parseInt(s.paid_cash_piastres || 0, 10) / 100), 0);
  const totalVehicleExpenses = vehicleExpenses.reduce((sum, e) => sum + (Math.abs(parseInt(e.amount_piastres || 0, 10)) / 100), 0);
  const netVehicleCash = totalVehicleCash - totalVehicleExpenses;

  // Filter products by category & search
  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategoryFilter === 'all' || p.category_id === selectedCategoryFilter;
    const matchSearch = productSearch.trim() === '' ||
      p.name_ar.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  // Active Branch Display
  const currentBranchName = locations.find(l => l.id === activeBranchId)?.name || 'الفرع الرئيسي';

  // Modal: Cloud Settings & Project Unpause
  const renderCloudSettingsModal = () => {
    if (!showCloudSettingsModal) return null;
    return (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-xl w-full p-6 text-white text-right space-y-4 animate-scaleUp">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pinko-accent/20 text-pinko-accent flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">إعدادات الاتصال بالسحابة (Supabase Cloud)</h3>
                <p className="text-xs text-slate-400">إدارة وتحديث ربط السحابة، استئناف المشروع، وتخصيص الخادم</p>
              </div>
            </div>
            <button
              onClick={() => setShowCloudSettingsModal(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cloud Status Box */}
          <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
            isCloudOnline === true
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
              : 'bg-amber-950/40 border-amber-800/50 text-amber-200'
          }`}>
            <div className="mt-0.5 shrink-0">
              {isCloudOnline === true ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-amber-400" />}
            </div>
            <div className="space-y-1">
              <div className="font-bold text-sm">
                {isCloudOnline === true ? 'الاتصال بالسحابة يعمل بنجاح 🟢' : 'مشروع Supabase متوقف مؤقتاً (Paused) ⚠️'}
              </div>
              <div className="text-slate-300 text-[11px] leading-relaxed">
                {isCloudOnline === true
                  ? 'قاعدة البيانات السحابية متصلة ومتاحة لتسجيل ومزامنة المنتجات، المبيعات، والمخازن مباشرة عبر جميع الأجهزة.'
                  : 'في باقة Supabase المجانية، تقوم منصة Supabase بإيقاف المشروع مؤقتاً إذا لم تحدث عمليات لمدة 7 أيام. لاستئناف العمل فوراً وبنقرة واحدة، اضغط على زر فتح لوحة التحكم بالأسفل واضغط Resume وسيتم تشغيل السيرفر خلال دقيقة.'}
              </div>
            </div>
          </div>

          {/* Quick Unpause Action */}
          <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white">1. استئناف المشروع السحابي الحالي (بنقرة واحدة):</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-bold">الخيار السريع</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              اضغط على الزر التالي لفتح صفحة مشروعك على موقع Supabase واضغط على <strong>Restore project (استعادة المشروع)</strong>:
            </p>
            <a
              href="https://supabase.com/dashboard/project/ibtqosnxktzxmniwhuqa"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>فتح لوحة تحكم Supabase لاستئناف المشروع (Resume ⚡)</span>
            </a>
          </div>

          {/* Custom URL & Key */}
          <div className="p-4 bg-slate-800/50 border border-slate-700/80 rounded-2xl space-y-3">
            <div className="font-bold text-xs text-white">2. أو ربط مشروع سحابي جديد / مخصص:</div>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Project URL:</label>
                <input
                  type="text"
                  value={customSupabaseUrl}
                  onChange={(e) => setCustomSupabaseUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono outline-none focus:border-pinko-accent"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">API Key (Anon / Secret):</label>
                <input
                  type="password"
                  value={customSupabaseKey}
                  onChange={(e) => setCustomSupabaseKey(e.target.value)}
                  placeholder="مفتاح السحابة..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono outline-none focus:border-pinko-accent"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isCheckingCloud}
                onClick={handleSaveCloudSettings}
                className="flex-1 py-2 bg-pinko-accent hover:bg-pink-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
              >
                {isCheckingCloud ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>حفظ واختبار الاتصال</span>
              </button>
              <button
                type="button"
                disabled={isCheckingCloud}
                onClick={handleResetCloudSettings}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                استعادة الافتراضي
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <button
              type="button"
              disabled={isCheckingCloud}
              onClick={checkCloudHealthStatus}
              className="text-pink-400 hover:text-pink-300 flex items-center gap-1 font-bold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingCloud ? 'animate-spin' : ''}`} />
              <span>إعادة فحص الاتصال الآن</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCloudSettingsModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDER: LOGIN SCREEN
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white select-none p-6 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute w-[500px] h-[500px] bg-pinko-accent/20 rounded-full blur-[140px] pointer-events-none -top-20 -left-20"></div>
        <div className="absolute w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none -bottom-20 -right-20"></div>

        <div className="max-w-4xl w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl shadow-2xl p-8 z-10 flex flex-col items-center">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-14 h-14 bg-pinko-accent rounded-2xl flex items-center justify-center font-black text-3xl shadow-lg shadow-pinko-accent/30">
              P
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                <span>Pinko App Desktop</span>
                <span className="text-xs font-bold px-2.5 py-1 bg-pinko-accent/20 border border-pinko-accent/40 text-pink-300 rounded-lg">
                  نسخة الكمبيوتر PC
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">منظومة مبيعات المخازن والتوزيع المترابطة سحابياً (Supabase Live)</p>
            </div>
          </div>

          <div className="w-full my-6 border-t border-slate-800"></div>

          {!selectedRole ? (
            <div className="w-full max-w-2xl">
              <h2 className="text-center font-bold text-slate-200 text-lg mb-6">
                اختر الحساب المطلوب لتسجيل الدخول:
              </h2>

              <div className="grid grid-cols-3 gap-5">
                <button
                  onClick={() => setSelectedRole('owner')}
                  className="p-6 bg-slate-800/80 hover:bg-slate-800 border-2 border-slate-700 hover:border-amber-400 rounded-2xl flex flex-col items-center text-center transition-all group hover:scale-[1.02]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold mb-4 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                    <Crown className="w-8 h-8" />
                  </div>
                  <span className="font-bold text-lg text-white mb-1">1. المالك (Owner)</span>
                  <span className="text-xs text-slate-400">صلاحيات كاملة، التبديل بين المحلين، المخازن، التقارير والأرباح</span>
                </button>

                <button
                  onClick={() => setSelectedRole('branch')}
                  className="p-6 bg-slate-800/80 hover:bg-slate-800 border-2 border-slate-700 hover:border-blue-400 rounded-2xl flex flex-col items-center text-center transition-all group hover:scale-[1.02]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold mb-4 group-hover:bg-blue-500 group-hover:text-slate-950 transition-colors">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <span className="font-bold text-lg text-white mb-1">2. فرع (محل 1 أو 2)</span>
                  <span className="text-xs text-slate-400">نقطة بيع الكاشير، استلام وتوريد المخزن، ومبيعات الفرع</span>
                </button>

                <button
                  onClick={() => setSelectedRole('vehicle')}
                  className="p-6 bg-slate-800/80 hover:bg-slate-800 border-2 border-slate-700 hover:border-emerald-400 rounded-2xl flex flex-col items-center text-center transition-all group hover:scale-[1.02]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold mb-4 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                    <Truck className="w-8 h-8" />
                  </div>
                  <span className="font-bold text-lg text-white mb-1">3. سيارة التوزيع</span>
                  <span className="text-xs text-slate-400">إدارة خط السير، تسليم المحطات، المصاريف، وصافي النقدية</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md animate-fadeIn">
              <button
                onClick={() => { setSelectedRole(null); setLoginError(''); setPasswordInput(''); }}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 mb-5"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة لاختيار حساب آخر</span>
              </button>

              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-pinko-accent/20 text-pinko-accent flex items-center justify-center font-bold">
                    {selectedRole === 'owner' ? <Crown className="w-6 h-6" /> : selectedRole === 'branch' ? <Building2 className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      تسجيل الدخول — {selectedRole === 'owner' ? 'المالك العام' : selectedRole === 'branch' ? 'مدير المحل' : 'سائق التوزيع (إبراهيم)'}
                    </h3>
                    <p className="text-xs text-slate-400">أدخل كلمة المرور المعتمدة للحساب</p>
                  </div>
                </div>

                {selectedRole === 'branch' && (
                  <div className="mb-4">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">اختر المحل:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBranchChoice('shop1_warehouse1')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          branchChoice === 'shop1_warehouse1'
                            ? 'bg-blue-600 text-white border-blue-500 shadow'
                            : 'bg-slate-700/60 text-slate-300 border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        المحل 1 (هناء)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranchChoice('shop2_warehouse2')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          branchChoice === 'shop2_warehouse2'
                            ? 'bg-blue-600 text-white border-blue-500 shadow'
                            : 'bg-slate-700/60 text-slate-300 border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        المحل 2 (محمد)
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">كلمة المرور:</label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="أدخل كلمة المرور..."
                      required
                      autoFocus
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-xl text-white text-sm font-bold focus:border-pinko-accent outline-none"
                    />
                  </div>

                  {loginError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-pinko-accent hover:bg-pink-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-pinko-accent/25 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>دخول للبرنامج</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Cloud Health & Settings quick status at login */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isCloudOnline === false ? 'bg-rose-500' : isCloudOnline === true ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isCloudOnline === false ? 'سحابة Supabase: متوقفة مؤقتاً (Paused)' : isCloudOnline === true ? 'سحابة Supabase: متصلة بنجاح' : 'جاري فحص الاتصال بالسحابة...'}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCloudSettingsModal(true)}
              className="text-pink-300 hover:text-white flex items-center gap-1 font-bold underline transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>إعدادات الربط واستئناف السحابة</span>
            </button>
          </div>
        </div>

        {/* Modal rendered on login view */}
        {renderCloudSettingsModal()}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: MAIN DESKTOP INTERFACE
  // -------------------------------------------------------------
  return (
    <div className="w-screen h-screen flex flex-row overflow-hidden bg-slate-100 text-slate-900 select-none">
      {/* -------------------------------------------------------------
          RIGHT DESKTOP SIDEBAR (Arabic RTL: Sidebar on the right)
          ------------------------------------------------------------- */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col justify-between border-l border-slate-800 shadow-2xl z-30 shrink-0">
        <div>
          {/* Logo & Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-11 h-11 bg-pinko-accent rounded-xl flex items-center justify-center font-black text-2xl shadow-md">
              P
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg">Pinko App</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pinko-accent/20 text-pink-300 rounded border border-pinko-accent/30">
                  PC
                </span>
              </div>
              <p className="text-[10px] text-slate-400">نظام إدارة مبيعات المخازن والتوزيع</p>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="p-4 mx-3 my-3 bg-slate-800/70 border border-slate-700/60 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pinko-plum text-pink-200 border border-pinko-accent/30 flex items-center justify-center font-bold">
              {currentUser.role === 'owner' ? <Crown className="w-5 h-5 text-amber-400" /> : currentUser.role === 'driver' ? <Truck className="w-5 h-5 text-emerald-400" /> : <Building2 className="w-5 h-5 text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-white truncate">{currentUser.full_name}</div>
              <div className="text-[10px] text-slate-400">
                {currentUser.role === 'owner' ? 'مالك النشاط (تحكم شامل)' : currentUser.role === 'driver' ? 'سائق سيارة التوزيع' : 'مدير الفرع والكاشير'}
              </div>
            </div>
          </div>

          {/* Owner Branch Switcher in Sidebar */}
          {currentUser.role === 'owner' && (
            <div className="px-3 mb-2">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">الفرع النشط الحالي:</label>
              <div className="grid grid-cols-2 gap-1.5">
                {locations.filter(l => l.type === 'shop_warehouse').map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => setActiveBranchId(loc.id)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all truncate ${
                      activeBranchId === loc.id
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {loc.name.split('—')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {currentUser.role !== 'driver' && (
              <>
                <button
                  onClick={() => setActiveTab('pos')}
                  className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                    activeTab === 'pos'
                      ? 'bg-pinko-accent text-white shadow-lg shadow-pinko-accent/20'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShoppingCart className="w-4 h-4" />
                    <span>نقطة البيع والكاشير</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 text-white/80">F1</span>
                </button>

                <button
                  onClick={() => setActiveTab('warehouse')}
                  className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                    activeTab === 'warehouse'
                      ? 'bg-pinko-accent text-white shadow-lg shadow-pinko-accent/20'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Boxes className="w-4 h-4" />
                    <span>إدارة وتوريد المخزن</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 text-white/80">F2</span>
                </button>

                <button
                  onClick={() => setActiveTab('reports')}
                  className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                    activeTab === 'reports'
                      ? 'bg-pinko-accent text-white shadow-lg shadow-pinko-accent/20'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4" />
                    <span>تقارير المبيعات والأرباح</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 text-white/80">F3</span>
                </button>
              </>
            )}

            {(currentUser.role === 'owner' || currentUser.role === 'driver') && (
              <button
                onClick={() => setActiveTab('vehicle')}
                className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                  activeTab === 'vehicle'
                    ? 'bg-pinko-accent text-white shadow-lg shadow-pinko-accent/20'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4" />
                  <span>خط سير سيارة التوزيع</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 text-white/80">F4</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Cloud Status Button */}
          <button
            onClick={() => setShowCloudSettingsModal(true)}
            className={`w-full px-3 py-2 border rounded-xl flex items-center justify-between text-[11px] transition-all text-right ${
              isCloudOnline === false
                ? 'bg-rose-950/50 border-rose-700/60 text-rose-300 hover:bg-rose-900/60'
                : isCloudOnline === true
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
            }`}
            title="إعدادات السحابة واستئناف المشروع"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isCloudOnline === false ? 'bg-rose-500' : isCloudOnline === true ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="truncate">{isCloudOnline === false ? 'سحابة Supabase متوقفة' : 'Supabase Cloud Live'}</span>
            </span>
            <span className="font-bold text-[10px] shrink-0">
              {isCloudOnline === false ? 'إصلاح ⚠️' : isCloudOnline === true ? 'متصل 🟢' : 'فحص... 🟡'}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* -------------------------------------------------------------
          MAIN DESKTOP WORKSPACE
          ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100">
        {/* Top Desktop Navigation & Controls Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-20 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
              {activeTab === 'pos' && '🛒 نقطة البيع ونظام الكاشير السحابي'}
              {activeTab === 'warehouse' && '📦 إدارة المخازن والتوريد بالكرتونة والعبوة'}
              {activeTab === 'reports' && '📊 لوحة التحليلات والتقارير المالية والأرباح'}
              {activeTab === 'vehicle' && '🚚 خط سير سيارة التوزيع وتصفية النقدية'}
            </h2>
            <div className="h-4 w-px bg-slate-300 mx-1"></div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {currentBranchName}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Clock & Date */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-pinko-accent" />
              <span>{currentTime}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => {
                if (activeBranchId) loadProducts(activeBranchId);
                if (activeTab === 'reports') loadReports();
                if (activeTab === 'vehicle') loadVehicleData(vehiclePeriod);
              }}
              disabled={loading}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors border border-slate-200"
              title="تحديث البيانات من السحابة"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-pinko-accent' : ''}`} />
            </button>
          </div>
        </header>

        {/* Cloud Health Warning Banner if Paused or Offline */}
        {isCloudOnline === false && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-amber-900 text-xs font-bold shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تنبيه: قاعدة بيانات Supabase السحابية متوقفة مؤقتاً (Paused) لعدم النشاط. يمكنك استئنافها بنقرة واحدة في 60 ثانية أو تعديل الربط.</span>
            </div>
            <button
              onClick={() => setShowCloudSettingsModal(true)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0 shadow-sm flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>استئناف السحابة / الإعدادات</span>
            </button>
          </div>
        )}

        {/* Global Floating Alert Notification */}
        {alertMsg && (
          <div
            className={`mx-6 mt-4 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-md animate-fadeIn z-30 ${
              alertMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : alertMsg.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-300'
                : 'bg-blue-50 text-blue-900 border-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{alertMsg.text}</span>
            </div>
            <button onClick={() => setAlertMsg(null)} className="p-1 hover:bg-black/5 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* -------------------------------------------------------------
            VIEW 1: DESKTOP POS & CASHIER (WIDESCREEN SPLIT SCREEN)
            ------------------------------------------------------------- */}
        {activeTab === 'pos' && (
          <div className="flex-1 flex flex-row overflow-hidden p-6 gap-6">
            {/* Left Column (60%): Products Catalog & Categories */}
            <div className="flex-[3] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Search & Category Filter Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ابحث عن منتج بالاسم أو كود SKU..."
                    className="w-full pr-10 pl-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-pinko-accent shadow-sm"
                  />
                </div>

                {/* Categories Tab Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedCategoryFilter === 'all'
                        ? 'bg-pinko-plum text-white shadow'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    جميع الأصناف ({products.length})
                  </button>
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategoryFilter(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        selectedCategoryFilter === c.id
                          ? 'bg-pinko-plum text-white shadow'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Cards Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredProducts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Boxes className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
                    <p className="text-sm font-bold">لا توجد منتجات مطابقة في هذا المخزن</p>
                    <p className="text-xs text-slate-400 mt-1">يمكنك توريد منتجات جديدة من تبويب [المخزن]</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredProducts.map(p => {
                      const retailEGP = p.retail_price_piastres / 100;
                      const isOutOfStock = p.on_hand_base <= 0;
                      const isLowStock = p.on_hand_base > 0 && p.on_hand_base < 20;

                      return (
                        <div
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="p-3.5 bg-white border border-slate-200 hover:border-pinko-accent/60 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                {p.category_name || 'عام'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  isOutOfStock
                                    ? 'bg-rose-100 text-rose-800'
                                    : isLowStock
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {p.on_hand_base} ق
                              </span>
                            </div>
                            <h3 className="font-bold text-xs text-slate-900 group-hover:text-pinko-accent transition-colors line-clamp-2">
                              {p.name_ar}
                            </h3>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-sm font-black text-slate-950">
                              {retailEGP.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">ج.م</span>
                            </span>
                            <div className="w-7 h-7 rounded-lg bg-pink-50 text-pinko-accent flex items-center justify-center font-bold group-hover:bg-pinko-accent group-hover:text-white transition-colors">
                              <Plus className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (40%): POS Terminal & Cart */}
            <div className="flex-[2] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              {/* Terminal Header & Customer */}
              <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-pinko-accent" />
                    <span>فاتورة المبيعات الحالية ({cart.length} أصناف)</span>
                  </h3>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800"
                    >
                      إفراغ السلة
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">اسم العميل (اختياري / للبيع الآجل):</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="عميل نقدي أو اسم المحل..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-pinko-accent"
                  />
                </div>
              </div>

              {/* Cart Items Table */}
              <div className="flex-1 overflow-y-auto p-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <ShoppingCart className="w-10 h-10 stroke-[1.5] mb-2 text-slate-300" />
                    <p className="text-xs font-bold">السلة فارغة حالياً</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">انقر على أي منتج لإضافته للفاتورة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div
                        key={item.product.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-bold text-slate-900 truncate">{item.product.name_ar}</div>
                          <div className="text-[10px] text-slate-500">
                            {item.unitPriceEGP.toFixed(2)} ج.م × {item.quantity} = {(item.unitPriceEGP * item.quantity).toFixed(2)} ج.م
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => updateCartQty(item.product.id, -1)}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold"
                          >
                            -
                          </button>
                          <span className="w-7 text-center font-bold text-slate-900">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(item.product.id, 1)}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Summary & Checkout Controls */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                {/* Math Totals */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>الإجمالي الفرعي:</span>
                    <span className="font-bold">{cartSubtotal.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-slate-600 items-center">
                    <span>الخصم (ج.م):</span>
                    <input
                      type="number"
                      value={discountEGP}
                      onChange={(e) => setDiscountEGP(e.target.value)}
                      className="w-20 px-2 py-0.5 bg-white border border-slate-300 rounded text-left font-bold outline-none"
                    />
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>المبلغ الإجمالي المستحق:</span>
                    <span className="text-pinko-plum">{cartTotal.toFixed(2)} ج.م</span>
                  </div>
                </div>

                {/* Cash & Credit Breakdown */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">المحصل نقداً (ج.م):</label>
                      <input
                        type="number"
                        value={paidCashEGP}
                        onChange={(e) => setPaidCashEGP(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-emerald-50/50 border border-emerald-300 rounded-lg text-emerald-950 font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">الآجل المستحق (ج.م):</label>
                      <input
                        type="text"
                        readOnly
                        value={computedCredit.toFixed(2)}
                        className="w-full px-2.5 py-1.5 bg-rose-50/50 border border-rose-300 rounded-lg text-rose-950 font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaidCashEGP(cartTotal.toString())}
                      className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                    >
                      دفع كامل نقداً
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidCashEGP('50')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                    >
                      50
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidCashEGP('100')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                    >
                      100
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidCashEGP('200')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                    >
                      200
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    disabled={loading || cart.length === 0}
                    onClick={() => handleCheckout(false)}
                    className="py-3 bg-pinko-plum hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>تأكيد وحفظ بالسحابة</span>
                  </button>

                  <button
                    disabled={loading || cart.length === 0}
                    onClick={() => handleCheckout(true)}
                    className="py-3 bg-pinko-accent hover:bg-pink-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>تأكيد وطباعة الفاتورة</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            VIEW 2: DESKTOP WAREHOUSE MANAGEMENT & INBOUND STOCK
            ------------------------------------------------------------- */}
        {activeTab === 'warehouse' && (
          <div className="flex-1 flex flex-row overflow-hidden p-6 gap-6">
            {/* Left Column (32%): Inbound Cartons Receiving Form */}
            <div className="flex-[1] bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                <Boxes className="w-5 h-5 text-pinko-accent" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">توريد واستلام كراتين للمخزن</h3>
                  <p className="text-[11px] text-slate-500">حساب عدد العبوات وتكلفة القطعة وهامش الربح</p>
                </div>
              </div>

              <form onSubmit={handleInboundStock} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الصنف (التصنيف):</label>
                  <input
                    type="text"
                    list="cat-list"
                    value={inboundCategoryName}
                    onChange={(e) => setInboundCategoryName(e.target.value)}
                    placeholder="مثال: شوكولاتات، بسكويتات..."
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-pinko-accent"
                  />
                  <datalist id="cat-list">
                    {categories.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">اسم المنتج:</label>
                  <input
                    type="text"
                    value={inboundProductName}
                    onChange={(e) => setInboundProductName(e.target.value)}
                    placeholder="مثال: شوكولاتة بينكو بالبندق"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-pinko-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">كود الصنف SKU (اختياري):</label>
                  <input
                    type="text"
                    value={inboundSku}
                    onChange={(e) => setInboundSku(e.target.value)}
                    placeholder="مثال: CHOC-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-pinko-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">عدد الكراتين:</label>
                    <input
                      type="number"
                      min="1"
                      value={inboundCartonQty}
                      onChange={(e) => setInboundCartonQty(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">العبوات بالكرتونة:</label>
                    <input
                      type="number"
                      min="1"
                      value={inboundPiecesPerCarton}
                      onChange={(e) => setInboundPiecesPerCarton(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">سعر الكرتونة (شراء ج.م):</label>
                    <input
                      type="number"
                      step="0.5"
                      value={inboundCartonCostEGP}
                      onChange={(e) => setInboundCartonCostEGP(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">سعر بيع العبوة (بيع ج.م):</label>
                    <input
                      type="number"
                      step="0.5"
                      value={inboundPieceRetailEGP}
                      onChange={(e) => setInboundPieceRetailEGP(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Live Real-time Math Preview Box */}
                {(() => {
                  const totalPieces = inboundCartonQty * inboundPiecesPerCarton;
                  const cCost = parseFloat(inboundCartonCostEGP) || 0;
                  const pieceCost = inboundPiecesPerCarton > 0 ? (cCost / inboundPiecesPerCarton) : 0;
                  const pieceRetail = parseFloat(inboundPieceRetailEGP) || 0;
                  const profitMargin = pieceRetail - pieceCost;
                  const marginPct = pieceCost > 0 ? (profitMargin / pieceCost) * 100 : 0;

                  return (
                    <div className="bg-indigo-50/60 border border-indigo-200 p-3.5 rounded-2xl space-y-2 text-xs">
                      <div className="font-bold text-indigo-950 flex items-center justify-between">
                        <span>إجمالي العبوات الموردة:</span>
                        <span className="font-black text-sm text-indigo-900">{totalPieces} عبوة</span>
                      </div>
                      <div className="flex justify-between text-indigo-900">
                        <span>تكلفة القطعة الواحدة:</span>
                        <span className="font-bold">{pieceCost.toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex justify-between text-indigo-900">
                        <span>سعر البيع المقترح:</span>
                        <span className="font-bold">{pieceRetail.toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex justify-between text-emerald-800 font-bold pt-1 border-t border-indigo-200">
                        <span>هامش الربح المتوقع للعبوة:</span>
                        <span>+{profitMargin.toFixed(2)} ج.م ({marginPct.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-pinko-plum hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>تأكيد التوريد وإضافة للمخزن السحابي</span>
                </button>
              </form>
            </div>

            {/* Right Column (68%): Full Widescreen Inventory Table */}
            <div className="flex-[2] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    أرصدة المخزون الحالي — {currentBranchName} ({products.length} صنف)
                  </h3>
                  <p className="text-[11px] text-slate-500">متابعة الكميات وسعر البيع وسعر التكلفة لكل صنف</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="بحث في المخزن..."
                      className="pr-8 pl-3 py-1 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Inventory Table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-3">الصنف</th>
                      <th className="p-3">اسم المنتج</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">سعر التكلفة</th>
                      <th className="p-3">سعر البيع</th>
                      <th className="p-3">نسبة الكرتونة</th>
                      <th className="p-3">الرصيد المتاح</th>
                      <th className="p-3">الحالة</th>
                      {currentUser.role === 'owner' && <th className="p-3 text-center">إجراء</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(p => {
                      const costEGP = p.cost_price_piastres / 100;
                      const retailEGP = p.retail_price_piastres / 100;
                      const isOutOfStock = p.on_hand_base <= 0;
                      const isLowStock = p.on_hand_base > 0 && p.on_hand_base < 20;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-500 font-bold">{p.category_name || '—'}</td>
                          <td className="p-3 font-bold text-slate-900">{p.name_ar}</td>
                          <td className="p-3 font-mono text-slate-500 text-[11px]">{p.sku}</td>
                          <td className="p-3 text-slate-600">{costEGP.toFixed(2)} ج.م</td>
                          <td className="p-3 font-bold text-slate-900">{retailEGP.toFixed(2)} ج.م</td>
                          <td className="p-3 text-slate-500">{p.carton_ratio} ق/كرتونة</td>
                          <td className="p-3 font-black text-slate-900">{p.on_hand_base} قطعة</td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isOutOfStock
                                  ? 'bg-rose-100 text-rose-800'
                                  : isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOutOfStock ? 'نفد المخزون' : isLowStock ? 'رصيد منخفض' : 'متوفر'}
                            </span>
                          </td>
                          {currentUser.role === 'owner' && (
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setEditingProduct({ ...p })}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                                  title="تعديل السعر أو الجرد (إيديت)"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name_ar)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors"
                                  title="حذف الصنف نهائياً من المخزن"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            VIEW 3: DESKTOP SALES REPORTS & ANALYTICS
            ------------------------------------------------------------- */}
        {activeTab === 'reports' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
            {/* Header Controls & Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              {/* Period Tabs */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">فترة التقرير:</span>
                <button
                  onClick={() => setReportPeriod('daily')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reportPeriod === 'daily' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  مبيعات اليوم
                </button>
                <button
                  onClick={() => setReportPeriod('monthly')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reportPeriod === 'monthly' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  مبيعات الشهر
                </button>
                <button
                  onClick={() => setReportPeriod('yearly')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reportPeriod === 'yearly' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  مبيعات السنة
                </button>
              </div>

              {/* Location Filter (Owner Only) */}
              {currentUser.role === 'owner' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">عرض الفرع:</span>
                  <button
                    onClick={() => setReportBranchFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      reportBranchFilter === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    إجمالي كل الفروع
                  </button>
                  <button
                    onClick={() => setReportBranchFilter('shop1')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      reportBranchFilter === 'shop1' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    المحل 1 (هناء)
                  </button>
                  <button
                    onClick={() => setReportBranchFilter('shop2')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      reportBranchFilter === 'shop2' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    المحل 2 (محمد)
                  </button>
                </div>
              )}
            </div>

            {/* 4 Large Desktop Metric Cards */}
            <div className="grid grid-cols-4 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold">إجمالي المبيعات</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {reportData.totalRevenue.toFixed(2)} <span className="text-xs font-normal text-slate-500">ج.م</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">شاملة الفواتير النقدية والآجلة</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-700 mb-2">
                  <span className="text-xs font-bold">المحصل نقداً</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-900">
                  {reportData.totalCash.toFixed(2)} <span className="text-xs font-normal text-emerald-600">ج.م</span>
                </div>
                <div className="text-[10px] text-emerald-700 mt-1">داخل خزينة المحل فعلياً</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-rose-700 mb-2">
                  <span className="text-xs font-bold">الآجل والديون المستحقة</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-900">
                  {reportData.totalCredit.toFixed(2)} <span className="text-xs font-normal text-rose-600">ج.م</span>
                </div>
                <div className="text-[10px] text-rose-700 mt-1">متبقي مطلوب سداده من العملاء</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-indigo-700 mb-2">
                  <span className="text-xs font-bold">صافي الأرباح التقديرية</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-indigo-900">
                  {reportData.totalProfit.toFixed(2)} <span className="text-xs font-normal text-indigo-600">ج.م</span>
                </div>
                <div className="text-[10px] text-indigo-700 mt-1">الأرباح = المبيعات - تكلفة الشراء</div>
              </div>
            </div>

            {/* Strict Invariant Formula Banner */}
            <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs font-bold shadow">
              <span className="text-slate-300">
                🔒 معادلة التحقق المالي الصارمة: إجمالي المبيعات ({reportData.totalRevenue.toFixed(2)} ج.م) = المحصل نقداً ({reportData.totalCash.toFixed(2)} ج.م) + الآجل المستحق ({reportData.totalCredit.toFixed(2)} ج.م)
              </span>
              <span className="text-emerald-400">مطابقة 100% بدون فروقات ✓</span>
            </div>

            {/* Dual Widescreen Section: Product Breakdown + Invoices List */}
            <div className="grid grid-cols-2 gap-6">
              {/* Product Performance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-bold text-xs text-slate-900">
                    مبيعات وأداء المنتجات في هذه الفترة ({reportData.productSales.length} صنف تم بيعه)
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto max-h-96">
                  {reportData.productSales.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">لا توجد مبيعات مسجلة في هذه الفترة</div>
                  ) : (
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                        <tr>
                          <th className="p-2.5">اسم المنتج</th>
                          <th className="p-2.5">الكمية المباعة</th>
                          <th className="p-2.5">إجمالي الإيراد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.productSales.map((ps, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">{ps.name}</td>
                            <td className="p-2.5 font-black text-pinko-plum">{ps.quantitySold} قطعة</td>
                            <td className="p-2.5 font-bold text-emerald-700">
                              {((ps.totalRevenuePiastres || 0) / 100).toFixed(2)} ج.م
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Invoices List with Settle Debt Capability */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900">
                    سجل الفواتير التفصيلي وتسديد الديون ({reportData.sales.length} فاتورة)
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto max-h-96">
                  {reportData.sales.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">لا توجد فواتير مسجلة في هذه الفترة</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {reportData.sales.map(s => {
                        const tot = s.total_piastres / 100;
                        const credit = (s.on_credit_piastres || 0) / 100;
                        const hasDebt = credit > 0;

                        return (
                          <div key={s.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                <span>{s.invoice_number}</span>
                                {hasDebt && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                    متبقي آجل: {credit.toFixed(2)} ج.م
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                العميل: {s.customers?.name || 'نقدي'} • الفرع: {s.locations?.name || '—'} • الإجمالي: {tot.toFixed(2)} ج.م
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {hasDebt && (
                                <button
                                  onClick={() => {
                                    setSettleDebtModal(s);
                                    setSettleAmountEGP(credit.toString());
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>تسديد الآجل</span>
                                </button>
                              )}
                              {currentUser?.role === 'owner' && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditSaleModal(s)}
                                    className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-colors"
                                    title="تعديل الفاتورة (صلاحية المالك)"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSale(s.id, s.invoice_number)}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors flex items-center gap-1 font-bold text-[11px]"
                                    title="حذف الفاتورة كـ (مرتجع مبيعات) وإرجاع البضاعة للمخزن السحابي"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>مرتجع / حذف</span>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setPrintReceiptModal(s)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                                title="طباعة الفاتورة"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            VIEW 4: DESKTOP VEHICLE ROUTE FLEET (إبراهيم)
            ------------------------------------------------------------- */}
        {activeTab === 'vehicle' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
            {/* Header Controls & Period Filter */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">فترة خط السير:</span>
                <button
                  onClick={() => setVehiclePeriod('daily')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    vehiclePeriod === 'daily' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  اليوم
                </button>
                <button
                  onClick={() => setVehiclePeriod('monthly')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    vehiclePeriod === 'monthly' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  الشهر
                </button>
                <button
                  onClick={() => setVehiclePeriod('yearly')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    vehiclePeriod === 'yearly' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  السنة
                </button>
              </div>

              <div className="text-xs font-bold text-slate-500">
                سيارة التوزيع المعتمدة — السائق إبراهيم
              </div>
            </div>

            {/* 3 Top Fleet Metric Cards */}
            <div className="grid grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-emerald-800">إجمالي المحصل نقداً من المحطات</span>
                <div className="text-2xl font-black text-emerald-950 my-1">
                  {totalVehicleCash.toFixed(2)} <span className="text-xs font-normal text-emerald-700">ج.م</span>
                </div>
                <span className="text-[10px] text-emerald-600">مجموع المبالغ النقدية المقبوضة</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-rose-800">إجمالي مصاريف السيارة</span>
                <div className="text-2xl font-black text-rose-950 my-1">
                  {totalVehicleExpenses.toFixed(2)} <span className="text-xs font-normal text-rose-700">ج.م</span>
                </div>
                <span className="text-[10px] text-rose-600">بنزين + صيانة + كارتة وإكراميات</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-blue-800">صافي نقدية السيارة الموردة</span>
                <div className="text-2xl font-black text-blue-950 my-1">
                  {netVehicleCash.toFixed(2)} <span className="text-xs font-normal text-blue-700">ج.م</span>
                </div>
                <span className="text-[10px] text-blue-600">الصافي = المحصل نقداً - المصاريف</span>
              </div>
            </div>

            {/* 2-Column Split: New Stop & Expense Form + Stops Records Table */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column: Register New Stop & Record Expense */}
              <div className="space-y-6">
                {/* Form 1: New Stop Delivery */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
                  <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <MapPin className="w-4 h-4 text-pinko-accent" />
                    <span>تسجيل تسليم محطة جديدة في خط السير</span>
                  </h3>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">اسم المحل أو العميل:</label>
                    <input
                      type="text"
                      value={stopShopName}
                      onChange={(e) => setStopShopName(e.target.value)}
                      placeholder="مثال: ماركت البركة - شارع السلام"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">الصنف:</label>
                      <select
                        value={stopSelectedCatId}
                        onChange={(e) => {
                          setStopSelectedCatId(e.target.value);
                          setStopSelectedProdId('');
                        }}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                      >
                        <option value="">-- اختر الصنف --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">اسم المنتج:</label>
                      <select
                        value={stopSelectedProdId}
                        onChange={(e) => {
                          setStopSelectedProdId(e.target.value);
                          const p = products.find(prod => prod.id === e.target.value);
                          if (p) setStopItemPriceEGP((p.retail_price_piastres / 100).toString());
                        }}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                      >
                        <option value="">-- اختر المنتج --</option>
                        {(stopSelectedCatId ? products.filter(p => p.category_id === stopSelectedCatId) : products).map(p => (
                          <option key={p.id} value={p.id}>{p.name_ar}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">سعر البيع (ج.م):</label>
                      <input
                        type="number"
                        value={stopItemPriceEGP}
                        onChange={(e) => setStopItemPriceEGP(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">الكمية المسلمة:</label>
                      <input
                        type="number"
                        min="1"
                        value={stopItemQty}
                        onChange={(e) => setStopItemQty(parseInt(e.target.value) || 1)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Mandatory Cash & Credit Fields */}
                  <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-900 block">
                      ⚠️ شرط إلزامي لحفظ المحطة: حدد المحصل نقداً أو المتبقي الآجل:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={stopCollectedEGP}
                        onChange={(e) => setStopCollectedEGP(e.target.value)}
                        placeholder="المحصل نقداً..."
                        className="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold outline-none"
                      />
                      <input
                        type="number"
                        value={stopRemainingEGP}
                        onChange={(e) => setStopRemainingEGP(e.target.value)}
                        placeholder="المتبقي الآجل..."
                        className="px-2.5 py-1.5 bg-white border border-rose-300 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                  <button
                    disabled={loading}
                    onClick={handleRecordVehicleStop}
                    className="w-full py-2.5 bg-pinko-plum hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>تسليم المحطة وحفظها في السحابة</span>
                  </button>
                </div>

                {/* Form 2: Vehicle Expense */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-rose-600" />
                    <span>تسجيل مصاريف سيارة التوزيع:</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={expAmountEGP}
                      onChange={(e) => setExpAmountEGP(e.target.value)}
                      placeholder="المبلغ (ج.م)..."
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                    <input
                      type="text"
                      value={expReason}
                      onChange={(e) => setExpReason(e.target.value)}
                      placeholder="سبب المصروف (بنزين/صيانة...)"
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                  <button
                    disabled={loading}
                    onClick={handleRecordVehicleExpense}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    تسجيل المصروف في السحابة
                  </button>
                </div>
              </div>

              {/* Right Column: Registered Stops & Expenses Lists */}
              <div className="space-y-6">
                {/* Registered Stops List */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-pinko-accent" />
                      <span>سجل محطات خط السير المسجلة ({vehicleStops.length} محطة)</span>
                    </h3>
                  </div>

                  <div className="p-3 max-h-72 overflow-y-auto space-y-2">
                    {vehicleStops.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">لا توجد محطات مسجلة في هذه الفترة</div>
                    ) : (
                      vehicleStops.map((stop, idx) => (
                        <div key={stop.id || idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-800">
                              محطة {idx + 1}: {stop.customers?.name || stop.notes}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(stop.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="font-black text-emerald-700 block">
                              +{(parseInt(stop.paid_cash_piastres || 0, 10) / 100).toFixed(2)} ج.م نقداً
                            </span>
                            {stop.on_credit_piastres > 0 && (
                              <span className="text-[10px] text-rose-600 font-bold block">
                                {(parseInt(stop.on_credit_piastres, 10) / 100).toFixed(2)} ج.م آجل
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Registered Expenses List */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-rose-600" />
                      <span>سجل مصاريف السيارة ({vehicleExpenses.length} مصروف)</span>
                    </h3>
                  </div>

                  <div className="p-3 max-h-56 overflow-y-auto space-y-2">
                    {vehicleExpenses.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">لا توجد مصاريف مسجلة في هذه الفترة</div>
                    ) : (
                      vehicleExpenses.map((exp, idx) => (
                        <div key={exp.id || idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-800">{exp.reason || 'مصروف عام'}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(exp.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <span className="font-black text-rose-700">
                            -{(Math.abs(parseInt(exp.amount_piastres, 10)) / 100).toFixed(2)} ج.م
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------
          MODAL: EDIT PRODUCT (OWNER ONLY)
          ------------------------------------------------------------- */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Edit className="w-4 h-4 text-pinko-accent" />
                <span>تعديل بيانات الصنف والجرد بالمخزن</span>
              </h3>
              <button onClick={() => setEditingProduct(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">اسم المنتج:</label>
                <div className="font-bold text-slate-900 text-sm">{editingProduct.name_ar}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">سعر البيع (ج.م):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingProduct.retail_price_piastres / 100}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      retail_price_piastres: Math.round(parseFloat(e.target.value || '0') * 100)
                    })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">سعر التكلفة (ج.م):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingProduct.cost_price_piastres / 100}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      cost_price_piastres: Math.round(parseFloat(e.target.value || '0') * 100)
                    })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الرصيد المتاح بالمخزن (قطعة):</label>
                <input
                  type="number"
                  value={editingProduct.on_hand_base}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    on_hand_base: parseInt(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleUpdateProduct}
                  disabled={loading}
                  className="px-5 py-2 bg-pinko-plum hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>حفظ التعديلات بالسحابة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: DEBT SETTLEMENT (تسديد الآجل)
          ------------------------------------------------------------- */}
      {settleDebtModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>تسديد دين / آجل فاتورة</span>
              </h3>
              <button onClick={() => setSettleDebtModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>رقم الفاتورة:</span>
                  <span className="font-mono font-bold text-slate-900">{settleDebtModal.invoice_number}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>العميل:</span>
                  <span className="font-bold text-slate-900">{settleDebtModal.customers?.name || 'نقدي'}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold pt-1 border-t border-slate-200">
                  <span>المبلغ الآجل المستحق:</span>
                  <span>{((settleDebtModal.on_credit_piastres || 0) / 100).toFixed(2)} ج.م</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ المراد سداده الآن (ج.م):</label>
                <input
                  type="number"
                  step="0.5"
                  value={settleAmountEGP}
                  onChange={(e) => setSettleAmountEGP(e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-50/40 border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 outline-none"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettleDebtModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSettleDebt}
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تأكيد السداد بالسحابة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: THERMAL / A4 PRINTABLE RECEIPT
          ------------------------------------------------------------- */}
      {printReceiptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 no-print">
              <span className="font-bold text-xs text-slate-700">معاينة وطباعة الفاتورة</span>
              <button onClick={() => setPrintReceiptModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal Slip Content */}
            <div className="bg-white text-slate-900 font-mono text-center p-4 border border-dashed border-slate-300 rounded-xl space-y-2">
              <div className="font-black text-lg">PINKO APP</div>
              <div className="text-[11px] text-slate-600">حلويات وشوكولاتة ومقرمشات</div>
              <div className="text-[10px] text-slate-500 border-b border-dashed border-slate-300 pb-2">
                رقم الفاتورة: {printReceiptModal.invoice_number}<br />
                التاريخ: {new Date(printReceiptModal.created_at || Date.now()).toLocaleString('ar-EG')}
              </div>

              <div className="text-right text-[11px] space-y-1 py-1">
                <div>الفرع: {printReceiptModal.locations?.name || 'الفرع الرئيسي'}</div>
                <div>الكاشير: {printReceiptModal.users?.full_name || currentUser.full_name}</div>
                <div>العميل: {printReceiptModal.customers?.name || 'عميل نقدي'}</div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 my-2 text-[11px] space-y-1">
                <div className="flex justify-between font-bold">
                  <span>الإجمالي المطلوب:</span>
                  <span>{((printReceiptModal.total_piastres || 0) / 100).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>المدفوع نقداً:</span>
                  <span>{((printReceiptModal.paid_cash_piastres || 0) / 100).toFixed(2)} ج.م</span>
                </div>
                {printReceiptModal.on_credit_piastres > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>المتبقي الآجل:</span>
                    <span>{((printReceiptModal.on_credit_piastres || 0) / 100).toFixed(2)} ج.م</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400">
                شكراً لتعاملكم معنا! • فاتورة إلكترونية معتمدة
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => setPrintReceiptModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-pinko-accent hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: EDIT SALE INVOICE (صلاحية تعديل الفواتير للمالك)
          ------------------------------------------------------------- */}
      {editingSaleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-scaleUp space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-sm text-slate-800">
                  تعديل الفاتورة: {editingSaleModal.invoice_number}
                </span>
              </div>
              <button onClick={() => setEditingSaleModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">العميل:</span>
                <span className="font-bold text-slate-800">{editingSaleModal.customers?.name || 'نقدي'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">إجمالي الفاتورة:</span>
                <span className="font-black text-slate-900">{((editingSaleModal.total_piastres || 0) / 100).toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ المحصل نقداً (ج.م):</label>
                <input
                  type="number"
                  value={editSaleCashEGP}
                  onChange={(e) => {
                    const cash = parseFloat(e.target.value) || 0;
                    const tot = (editingSaleModal.total_piastres || 0) / 100;
                    setEditSaleCashEGP(e.target.value);
                    setEditSaleCreditEGP(Math.max(0, tot - cash).toFixed(2));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ المتبقي الآجل (ج.م):</label>
                <input
                  type="number"
                  value={editSaleCreditEGP}
                  onChange={(e) => setEditSaleCreditEGP(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات الفاتورة:</label>
                <textarea
                  value={editSaleNotes}
                  onChange={(e) => setEditSaleNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingSaleModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveSaleEdit}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>حفظ التعديلات بالسحابة</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Cloud Settings & Restore */}
      {renderCloudSettingsModal()}
    </div>
  );
}
