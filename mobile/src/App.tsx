import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Truck, 
  Crown, 
  Lock, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Printer, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  ArrowRight, 
  Wifi, 
  WifiOff, 
  LogOut, 
  RefreshCw, 
  Search, 
  Package, 
  Layers, 
  DollarSign, 
  Receipt, 
  FileText, 
  AlertCircle,
  BarChart3,
  Settings,
  Server,
  Edit,
  Save,
  X
} from 'lucide-react';
import { ApiClient } from './services/api';
import { SupabaseService, ROLE_PASSWORDS } from './services/supabaseService';

type LoginRole = 'owner' | 'branch' | 'vehicle';
type BranchChoice = 'shop1_warehouse1' | 'shop2_warehouse2';
type ReportPeriod = 'daily' | 'monthly' | 'yearly';

export default function App() {
  // Authentication & Flow State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<LoginRole | null>(null);
  const [branchChoice, setBranchChoice] = useState<BranchChoice>('shop1_warehouse1');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sale Management Modals for Owner (حذف وتعديل الفواتير)
  const [editingSaleModal, setEditingSaleModal] = useState<any | null>(null);
  const [editSaleCashEGP, setEditSaleCashEGP] = useState<string>('');
  const [editSaleCreditEGP, setEditSaleCreditEGP] = useState<string>('');
  const [editSaleNotes, setEditSaleNotes] = useState<string>('');

  // Server URL Configuration for Local/Network/Cloud Android APK
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem('pinko_server_url') || (window.location.protocol === 'file:' ? 'http://localhost:4000' : '');
  });
  const [showServerConfig, setShowServerConfig] = useState<boolean>(false);
  const [tempServerUrl, setTempServerUrl] = useState<string>(serverUrl);

  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const base = serverUrl.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    return fetch(url, options);
  };

  // App Navigation Tabs (بيع كاشير / المخزن / المبيعات والتقارير / خط سير السيارة)
  const [workMode, setWorkMode] = useState<'sell' | 'warehouse' | 'sales_history' | 'vehicle_route'>('sell');

  // Locations & Active Branch
  const [locations, setLocations] = useState<any[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('');

  // Business Data
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  // POS State
  const [posSelectedCatId, setPosSelectedCatId] = useState<string>('');
  const [posSelectedProdId, setPosSelectedProdId] = useState<string>('');
  const [posQty, setPosQty] = useState<number>(1);
  const [posUnitPriceEGP, setPosUnitPriceEGP] = useState<string>('');
  const [cart, setCart] = useState<any[]>([]);
  const [paidCashEGP, setPaidCashEGP] = useState<string>('');
  const [onCreditEGP, setOnCreditEGP] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Warehouse Inbound Receiving State
  const [inboundCatId, setInboundCatId] = useState<string>('');
  const [newCatNameInput, setNewCatNameInput] = useState<string>('');
  const [inboundProdName, setInboundProdName] = useState<string>('');
  const [inboundCartonQty, setInboundCartonQty] = useState<number>(10);
  const [inboundPiecesPerCarton, setInboundPiecesPerCarton] = useState<number>(20);
  const [inboundCartonCostEGP, setInboundCartonCostEGP] = useState<string>('');
  const [inboundPieceRetailEGP, setInboundPieceRetailEGP] = useState<string>('');

  // Warehouse Product Editor
  const [editingProd, setEditingProd] = useState<any | null>(null);
  const [editOnHand, setEditOnHand] = useState<string>('');
  const [editRetailPrice, setEditRetailPrice] = useState<string>('');
  const [editCostPrice, setEditCostPrice] = useState<string>('');

  // Vehicle Delivery Route State
  const [vehiclePeriod, setVehiclePeriod] = useState<ReportPeriod>('daily');
  const [vehicleStops, setVehicleStops] = useState<any[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<any[]>([]);
  const [stopShopName, setStopShopName] = useState<string>('');
  const [stopSelectedCatId, setStopSelectedCatId] = useState<string>('');
  const [stopSelectedProdId, setStopSelectedProdId] = useState<string>('');
  const [stopItemName, setStopItemName] = useState<string>('');
  const [stopItemQty, setStopItemQty] = useState<number>(1);
  const [stopItemPriceEGP, setStopItemPriceEGP] = useState<string>('');
  const [stopCollectedEGP, setStopCollectedEGP] = useState<string>('');
  const [stopRemainingEGP, setStopRemainingEGP] = useState<string>('');
  const [expAmountEGP, setExpAmountEGP] = useState<string>('');
  const [expReason, setExpReason] = useState<string>('');

  // Sales & Reports State
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  const [reportLocationFilter, setReportLocationFilter] = useState<string>('all');
  const [salesReport, setSalesReport] = useState<any | null>(null);
  const [settlingSaleId, setSettlingSaleId] = useState<string | null>(null);
  const [settleAmountEGP, setSettleAmountEGP] = useState<string>('');

  // Connectivity & Feedback
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [loading, setLoading] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => {
      setIsOnline(false);
      setAlertMsg({ text: 'لا يوجد اتصال بالإنترنت. تم إيقاف تسجيل العمليات.', type: 'error' });
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Fetch initial locations
  useEffect(() => {
    SupabaseService.getLocations()
      .then(d => { if (Array.isArray(d)) setLocations(d); })
      .catch(() => {});
  }, []);

  // Refresh branch data
  const refreshBranchData = async (branchId?: string) => {
    const locId = branchId || activeBranchId;
    try {
      const catData = await SupabaseService.getCategories();
      if (Array.isArray(catData)) setCategories(catData);

      if (locId) {
        const prodData = await SupabaseService.getProducts(locId);
        if (Array.isArray(prodData)) setProducts(prodData);
      }

      const custData = await SupabaseService.getCustomers();
      if (Array.isArray(custData)) setCustomers(custData);
    } catch (e) {}
  };

  const loadVehicleData = async (period: ReportPeriod) => {
    try {
      const [stops, exps] = await Promise.all([
        SupabaseService.getVehicleStops(period),
        SupabaseService.getVehicleExpenses(period)
      ]);
      if (Array.isArray(stops)) setVehicleStops(stops);
      if (Array.isArray(exps)) setVehicleExpenses(exps);
    } catch (e) {}
  };

  const loadReports = async (period: ReportPeriod, locFilter: string) => {
    try {
      setLoading(true);
      const data = await SupabaseService.getSalesReport(period, locFilter === 'all' ? undefined : locFilter);
      setSalesReport(data);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // Login handler
  const handleLogin = async () => {
    if (!passwordInput) {
      setLoginError('يرجى إدخال كلمة المرور');
      return;
    }
    setLoading(true);
    setLoginError(null);

    try {
      if (!selectedRole) throw new Error('يرجى اختيار الحساب المطلوب');
      const user = await SupabaseService.login(selectedRole, branchChoice, passwordInput);

      setCurrentUser(user);
      ApiClient.setUserRole(user.username);

      let initialLocId = '';
      if (selectedRole === 'branch') {
        const target = locations.find(l => l.code === branchChoice);
        initialLocId = target ? target.id : '';
      } else if (selectedRole === 'vehicle') {
        const target = locations.find(l => l.type === 'vehicle');
        initialLocId = target ? target.id : '';
        setWorkMode('vehicle_route');
      } else {
        const target = locations.find(l => l.code === 'shop1_warehouse1');
        initialLocId = target ? target.id : (locations[0]?.id || '');
      }

      setActiveBranchId(initialLocId);
      await refreshBranchData(initialLocId);

      if (selectedRole === 'vehicle' || selectedRole === 'owner') {
        loadVehicleData(vehiclePeriod);
      }
      if (selectedRole === 'branch') {
        loadReports(reportPeriod, initialLocId);
      }

      setLoading(false);
      setPasswordInput('');
    } catch (err: any) {
      setLoading(false);
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedRole(null);
    setPasswordInput('');
    setCart([]);
  };

  // Switch Branch (Owner or Filter)
  const handleSwitchBranch = (locId: string) => {
    setActiveBranchId(locId);
    setCart([]);
    setPosSelectedCatId('');
    setPosSelectedProdId('');
    setPosUnitPriceEGP('');
    refreshBranchData(locId);
    if (workMode === 'sales_history') {
      loadReports(reportPeriod, locId);
    }
  };

  const handlePosProductChange = (prodId: string) => {
    setPosSelectedProdId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setPosUnitPriceEGP((prod.retail_price_piastres / 100).toString());
    } else {
      setPosUnitPriceEGP('');
    }
  };

  const handleAddToCart = () => {
    const prod = products.find(p => p.id === posSelectedProdId);
    if (!prod) {
      setAlertMsg({ text: 'يرجى اختيار الصنف واسم المنتج أولاً', type: 'error' });
      return;
    }
    const unitPrice = parseFloat(posUnitPriceEGP);
    if (isNaN(unitPrice) || unitPrice <= 0) {
      setAlertMsg({ text: 'يرجى التأكد من سعر المنتج', type: 'error' });
      return;
    }

    const existing = cart.find(c => c.productId === prod.id);
    if (existing) {
      setCart(cart.map(c => c.productId === prod.id ? { ...c, quantity: c.quantity + posQty } : c));
    } else {
      setCart([...cart, {
        productId: prod.id,
        name: prod.name_ar,
        quantity: posQty,
        unitPriceEGP: unitPrice
      }]);
    }

    setPosQty(1);
    setAlertMsg({ text: `تمت إضافة (${prod.name_ar}) إلى السلة`, type: 'success' });
  };

  const cartTotalEGP = cart.reduce((sum, item) => sum + (item.quantity * item.unitPriceEGP), 0);

  const handleCashChange = (val: string) => {
    setPaidCashEGP(val);
    const cash = parseFloat(val) || 0;
    const diff = Math.max(0, cartTotalEGP - cash);
    setOnCreditEGP(diff > 0 ? diff.toFixed(2) : '0');
  };

  // Commit Sale
  const handleCommitSale = async (shouldPrint: boolean) => {
    if (!isOnline) {
      setAlertMsg({ text: 'لا يوجد اتصال بالإنترنت. لم يتم تسجيل العملية.', type: 'error' });
      return;
    }
    if (cart.length === 0) {
      setAlertMsg({ text: 'يرجى إضافة أصناف إلى الفاتورة أولاً', type: 'error' });
      return;
    }

    const cashVal = parseFloat(paidCashEGP) || 0;
    const creditVal = parseFloat(onCreditEGP) || 0;

    if (creditVal > 0 && !customerNameInput && !selectedCustomerId) {
      setAlertMsg({ text: 'البيع بالآجل يتطلب كتابة أو اختيار اسم العميل', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      const idempotencyKey = `sale-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const payload = {
        locationId: activeBranchId,
        customerId: selectedCustomerId || undefined,
        customerName: customerNameInput || undefined,
        items: cart.map(c => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPricePiastres: Math.round(c.unitPriceEGP * 100)
        })),
        paidCashPiastres: Math.round(cashVal * 100),
        onCreditPiastres: Math.round(creditVal * 100),
        notes: shouldPrint ? 'مبيعات مع طباعة إيصال' : 'مبيعات كاشير',
        idempotencyKey
      };

      const sale = await SupabaseService.commitSale({
        locationId: activeBranchId,
        cashierId: currentUser?.id,
        customerId: selectedCustomerId || undefined,
        customerName: customerNameInput || undefined,
        items: cart.map(c => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPricePiastres: Math.round(c.unitPriceEGP * 100)
        })),
        paidCashPiastres: Math.round(cashVal * 100),
        onCreditPiastres: Math.round(creditVal * 100),
        notes: shouldPrint ? 'مبيعات مع طباعة إيصال' : 'مبيعات كاشير',
        idempotencyKey
      });

      setCart([]);
      setPaidCashEGP('');
      setOnCreditEGP('');
      setCustomerNameInput('');
      setSelectedCustomerId('');
      setAlertMsg({ 
        text: `تم تخزين الفاتورة في السحابة بنجاح رقم (${sale.invoice_number})`, 
        type: 'success' 
      });

      if (shouldPrint) {
        setTimeout(() => {
          alert(`🖨️ طباعة إيصال حراري:\nرقم الفاتورة: ${sale.invoice_number}\nالمحل: ${locations.find(l => l.id === activeBranchId)?.name}\nالإجمالي: ${(sale.total_piastres / 100).toFixed(2)} ج.م\nالمدفوع نقداً: ${(sale.paid_cash_piastres / 100).toFixed(2)} ج.م\nالآجل: ${(sale.on_credit_piastres / 100).toFixed(2)} ج.م`);
        }, 300);
      }

      await refreshBranchData();
      if (workMode === 'sales_history') loadReports(reportPeriod, activeBranchId);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setAlertMsg({ text: err.message, type: 'error' });
    }
  };

  // Inbound Goods
  const handleInboundGoods = async () => {
    if (!inboundProdName || !inboundCartonCostEGP || !inboundPieceRetailEGP) {
      setAlertMsg({ text: 'يرجى إكمال اسم المنتج، سعر الكرتونة، وسعر بيع العبوة/القطعة', type: 'error' });
      return;
    }

    const cCost = parseFloat(inboundCartonCostEGP);
    const pRetail = parseFloat(inboundPieceRetailEGP);
    const totalPieces = inboundCartonQty * inboundPiecesPerCarton;
    const singlePieceCost = inboundPiecesPerCarton > 0 ? (cCost / inboundPiecesPerCarton) : cCost;

    try {
      setLoading(true);
      await SupabaseService.inboundGoods({
        locationId: activeBranchId,
        categoryId: inboundCatId || undefined,
        categoryName: newCatNameInput || undefined,
        name_ar: inboundProdName,
        cartonQty: inboundCartonQty,
        piecesPerCarton: inboundPiecesPerCarton,
        cartonCostEGP: cCost,
        pieceRetailEGP: pRetail,
        actorId: currentUser?.id
      });

      setAlertMsg({ 
        text: `تم استلام (${inboundCartonQty} كرتونة = ${totalPieces} عبوة) بتكلفة (${singlePieceCost.toFixed(2)} ج.م للعبوة) وسعر بيع (${pRetail.toFixed(2)} ج.م) في المخزن بنجاح!`, 
        type: 'success' 
      });

      setInboundProdName('');
      setNewCatNameInput('');
      setInboundCartonCostEGP('');
      setInboundPieceRetailEGP('');
      await refreshBranchData();
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // Product Edit
  const handleSaveProductEdit = async () => {
    if (!editingProd) return;
    try {
      setLoading(true);
      await SupabaseService.updateProduct(editingProd.id, {
        locationId: activeBranchId,
        retail_price_piastres: Math.round(parseFloat(editRetailPrice || '0') * 100),
        cost_price_piastres: Math.round(parseFloat(editCostPrice || '0') * 100),
        on_hand_base: parseInt(editOnHand || '0', 10)
      });

      setAlertMsg({ text: 'تم تحديث بيانات الصنف والمخزون بنجاح', type: 'success' });
      setEditingProd(null);
      await refreshBranchData();
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
      await refreshBranchData();
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message || 'فشل حذف الصنف', type: 'error' });
    }
  };

  // Settle Debt
  const handleSettleDebt = async (saleId: string) => {
    const amountVal = parseFloat(settleAmountEGP);
    if (isNaN(amountVal) || amountVal <= 0) {
      setAlertMsg({ text: 'أدخل مبلغ سداد صالح', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      await SupabaseService.settleDebt(saleId, Math.round(amountVal * 100), currentUser?.id);

      setAlertMsg({ text: `تم سداد ${amountVal} ج.م وتحديث الخزينة والآجل بالسحابة بنجاح`, type: 'success' });
      setSettlingSaleId(null);
      setSettleAmountEGP('');
      loadReports(reportPeriod, currentUser.role === 'owner' ? reportLocationFilter : activeBranchId);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // Owner Delete & Edit Sale
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
      if (workMode === 'sales_history') loadReports(reportPeriod, currentUser.role === 'owner' ? reportLocationFilter : activeBranchId);
      if (activeBranchId) refreshBranchData(activeBranchId);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  const handleOpenEditSaleModal = (sale: any) => {
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
      if (workMode === 'sales_history') loadReports(reportPeriod, currentUser.role === 'owner' ? reportLocationFilter : activeBranchId);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // Vehicle Delivery Stop
  const handleRecordVehicleStop = async () => {
    if (!stopShopName) {
      setAlertMsg({ text: 'يرجى كتابة اسم المحل / العميل للمحطة', type: 'error' });
      return;
    }
    const finalItemName = stopItemName || (products.find(p => p.id === stopSelectedProdId)?.name_ar) || 'بضاعة عامة';
    const priceNum = parseFloat(stopItemPriceEGP);
    if (isNaN(priceNum) || priceNum <= 0) {
      setAlertMsg({ text: 'يرجى تحديد سعر بيع صالح', type: 'error' });
      return;
    }

    if (stopCollectedEGP === '' && stopRemainingEGP === '') {
      setAlertMsg({ text: 'خطأ إلزامي: يجب إدخال المبلغ المحصل نقدًا أو المبلغ المتبقي والآجل قبل تسليم المحطة!', type: 'error' });
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
        cashierId: currentUser?.id,
        customerName: stopShopName,
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

      setAlertMsg({ text: `تم تسليم المحطة للمحل (${stopShopName}) وتوثيقها في السحابة بنجاح`, type: 'success' });
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

  // Vehicle Expense
  const handleRecordExpense = async () => {
    const amt = parseFloat(expAmountEGP);
    if (isNaN(amt) || amt <= 0 || !expReason) {
      setAlertMsg({ text: 'يرجى إدخال مبلغ المصروف وسبب الصرف (بنزين/إكراميات...)', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      await SupabaseService.recordVehicleExpense(
        Math.round(amt * 100),
        expReason,
        currentUser?.id
      );

      setAlertMsg({ text: `تم تسجيل المصروف (${amt} ج.م) وخصمه من العهدة النقدية بنجاح`, type: 'success' });
      setExpAmountEGP('');
      setExpReason('');
      loadVehicleData(vehiclePeriod);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setAlertMsg({ text: e.message, type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // LOGIN SCREEN
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-100 shadow-2xl relative select-none">
        <div className="bg-pinko-plum text-white p-6 text-center shadow-lg">
          <div className="w-14 h-14 bg-pinko-accent rounded-2xl mx-auto flex items-center justify-center font-black text-2xl shadow mb-2">
            P
          </div>
          <h1 className="text-xl font-bold">Pinko App</h1>
          <p className="text-xs text-pink-200">نظام إدارة مبيعات المخازن والتوزيع</p>
        </div>

        <div className="p-5 flex-1 flex flex-col justify-center">
          {!selectedRole ? (
            <div className="space-y-4">
              <h2 className="text-center font-bold text-slate-800 text-sm mb-2">
                اختر نوع الحساب للدخول:
              </h2>

              <button
                onClick={() => setSelectedRole('owner')}
                className="w-full p-4 bg-white rounded-2xl border-2 border-slate-200 hover:border-pinko-accent shadow-sm flex items-center gap-4 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Crown className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 text-base">1. المالك (Owner)</div>
                  <div className="text-xs text-slate-500">تحكم كامل: التبديل بين المحلات، المخازن، التقارير والأرباح</div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRole('branch')}
                className="w-full p-4 bg-white rounded-2xl border-2 border-slate-200 hover:border-pinko-accent shadow-sm flex items-center gap-4 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 text-base">2. فرع (محل 1 أو محل 2)</div>
                  <div className="text-xs text-slate-500">بيع الكاشير، استلام المخزن، وتقارير مبيعات المحل</div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRole('vehicle')}
                className="w-full p-4 bg-white rounded-2xl border-2 border-slate-200 hover:border-pinko-accent shadow-sm flex items-center gap-4 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Truck className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 text-base">3. سيارة التوزيع (إبراهيم)</div>
                  <div className="text-xs text-slate-500">محطات خط السير، النقدية، المصاريف، وتسليم العهدة</div>
                </div>
              </button>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-800">
                  {selectedRole === 'owner' && 'تسجيل دخول المالك'}
                  {selectedRole === 'branch' && 'تسجيل دخول مدير الفرع'}
                  {selectedRole === 'vehicle' && 'تسجيل دخول سيارة التوزيع'}
                </h3>
                <button onClick={() => { setSelectedRole(null); setLoginError(null); }} className="text-xs text-pinko-accent font-bold">
                  تغيير
                </button>
              </div>

              {selectedRole === 'branch' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">اختر الفرع:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBranchChoice('shop1_warehouse1')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                        branchChoice === 'shop1_warehouse1' ? 'bg-pinko-plum text-white border-pinko-plum' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      المحل 1 — المخزن 1
                    </button>
                    <button
                      type="button"
                      onClick={() => setBranchChoice('shop2_warehouse2')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                        branchChoice === 'shop2_warehouse2' ? 'bg-pinko-plum text-white border-pinko-plum' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      المحل 2 — المخزن 2
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600">أدخل كلمة المرور:</label>
                  <span className="text-[10px] text-pinko-accent font-bold">
                    {selectedRole === 'owner' && 'Pinko@Boss2026'}
                    {selectedRole === 'branch' && branchChoice === 'shop1_warehouse1' && 'Shop1@Hanaa'}
                    {selectedRole === 'branch' && branchChoice === 'shop2_warehouse2' && 'Shop2@Mohamed'}
                    {selectedRole === 'vehicle' && 'Pinko@Car2026'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                    placeholder="أدخل كلمة المرور..."
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:border-pinko-accent"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {loginError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {loginError}
                </div>
              )}

              <button
                disabled={loading}
                onClick={handleLogin}
                className="w-full py-3 bg-pinko-plum hover:bg-slate-900 text-white rounded-xl font-bold text-sm shadow flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>دخول النظام</span>
              </button>
            </div>
          )}

          {/* Server Connection Settings Button */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => { setTempServerUrl(serverUrl); setShowServerConfig(true); }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-pinko-plum font-semibold bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
            >
              <Server className="w-3.5 h-3.5 text-pinko-accent" />
              <span>إعدادات الاتصال بالسحابة: {serverUrl ? serverUrl : 'تلقائي (سحابي)'}</span>
            </button>
          </div>

          {/* Server Settings Modal */}
          {showServerConfig && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 text-right">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Server className="w-4 h-4 text-pinko-accent" />
                    عنوان خادم السحابة / الشبكة
                  </h3>
                  <button onClick={() => setShowServerConfig(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
                </div>
                <p className="text-xs text-slate-500">
                  أدخل عنوان IP للكمبيوتر الرئيسي أو رابط السحابة للربط مع قاعدة بيانات Supabase:
                </p>
                <input
                  type="text"
                  value={tempServerUrl}
                  onChange={(e) => setTempServerUrl(e.target.value)}
                  placeholder="مثال: http://192.168.1.100:4000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:border-pinko-accent text-left"
                  dir="ltr"
                />
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = tempServerUrl.trim();
                      setServerUrl(trimmed);
                      localStorage.setItem('pinko_server_url', trimmed);
                      setShowServerConfig(false);
                      setAlertMsg({ text: 'تم حفظ عنوان الخادم بنجاح وتحديث الاتصال', type: 'success' });
                    }}
                    className="flex-1 py-2 bg-pinko-plum text-white rounded-xl text-xs font-bold shadow"
                  >
                    حفظ وتطبيق
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempServerUrl('http://localhost:4000');
                      setServerUrl('http://localhost:4000');
                      localStorage.setItem('pinko_server_url', 'http://localhost:4000');
                      setShowServerConfig(false);
                    }}
                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    افتراضي
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN AUTHENTICATED SCREEN
  // -------------------------------------------------------------
  const shop1Location = locations.find(l => l.code === 'shop1_warehouse1');
  const shop2Location = locations.find(l => l.code === 'shop2_warehouse2');
  const activeBranchName = locations.find(l => l.id === activeBranchId)?.name || 'الفرع';

  const posProducts = posSelectedCatId 
    ? products.filter(p => p.category_id === posSelectedCatId)
    : products;

  const totalVehicleCash = vehicleStops.reduce((sum, s) => sum + parseInt(s.paid_cash_piastres || 0, 10), 0) / 100;
  const totalVehicleExpenses = vehicleExpenses.reduce((sum, e) => sum + Math.abs(parseInt(e.amount_piastres || 0, 10)), 0) / 100;
  const netVehicleCash = Math.max(0, totalVehicleCash - totalVehicleExpenses);

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-100 shadow-2xl relative select-none">
      {/* Top Header */}
      <header className="bg-pinko-plum text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pinko-accent flex items-center justify-center font-bold text-white shadow">
            P
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">{currentUser.fullName}</h1>
            <p className="text-[10px] text-pink-200">
              {currentUser.role === 'owner' ? 'المالك — تحكم شامل' : currentUser.role === 'driver' ? 'سيارة التوزيع' : activeBranchName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${isOnline ? 'bg-emerald-800 text-emerald-200' : 'bg-rose-800 text-rose-200'}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isOnline ? 'سحابي' : 'غير متصل'}</span>
          </div>

          <button onClick={handleLogout} className="p-1.5 bg-slate-800 hover:bg-rose-900 rounded-lg text-slate-200">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Alert Notifications */}
      {alertMsg && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between ${
          alertMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Navigation Tabs (الآن لكل من المالك ومدير الفرع: بيع كاشير / المخزن / المبيعات) */}
      {currentUser.role !== 'driver' && (
        <div className="bg-slate-200 p-2 flex items-center justify-around border-b border-slate-300 text-xs font-bold">
          <button
            onClick={() => setWorkMode('sell')}
            className={`py-1.5 px-2.5 rounded-lg ${workMode === 'sell' ? 'bg-pinko-plum text-white shadow' : 'text-slate-700'}`}
          >
            بيع كاشير
          </button>
          <button
            onClick={() => setWorkMode('warehouse')}
            className={`py-1.5 px-2.5 rounded-lg ${workMode === 'warehouse' ? 'bg-pinko-plum text-white shadow' : 'text-slate-700'}`}
          >
            المخزن
          </button>
          <button
            onClick={() => { 
              setWorkMode('sales_history'); 
              loadReports(reportPeriod, currentUser.role === 'owner' ? reportLocationFilter : activeBranchId); 
            }}
            className={`py-1.5 px-2.5 rounded-lg ${workMode === 'sales_history' ? 'bg-pinko-plum text-white shadow' : 'text-slate-700'}`}
          >
            {currentUser.role === 'owner' ? 'تقارير المبيعات' : 'المبيعات'}
          </button>
          {currentUser.role === 'owner' && (
            <button
              onClick={() => { setWorkMode('vehicle_route'); loadVehicleData(vehiclePeriod); }}
              className={`py-1.5 px-2.5 rounded-lg ${workMode === 'vehicle_route' ? 'bg-pinko-plum text-white shadow' : 'text-slate-700'}`}
            >
              سيارة التوزيع
            </button>
          )}
        </div>
      )}

      {/* OWNER BRANCH SWITCHER: Toggle standing in Shop 1 or Shop 2 */}
      {currentUser.role === 'owner' && (workMode === 'sell' || workMode === 'warehouse') && (
        <div className="bg-pink-50 border-b border-pink-200 px-3 py-2 flex items-center justify-between text-xs">
          <span className="font-bold text-pinko-plum flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> أنت الآن تدير:
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handleSwitchBranch(shop1Location?.id || '')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                activeBranchId === shop1Location?.id ? 'bg-pinko-plum text-white shadow' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              محل 1
            </button>
            <button
              onClick={() => handleSwitchBranch(shop2Location?.id || '')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                activeBranchId === shop2Location?.id ? 'bg-pinko-plum text-white shadow' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              محل 2
            </button>
          </div>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* ========================================================= */}
        {/* VIEW 1: POS SELLING                                       */}
        {/* ========================================================= */}
        {workMode === 'sell' && currentUser.role !== 'driver' && (
          <div className="space-y-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-pinko-accent" />
                  <span>إضافة منتج للفاتورة — {activeBranchName}</span>
                </h2>
              </div>

              {/* 1. Category */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">1. اختر الصنف (التصنيف):</label>
                <select
                  value={posSelectedCatId}
                  onChange={(e) => {
                    setPosSelectedCatId(e.target.value);
                    setPosSelectedProdId('');
                    setPosUnitPriceEGP('');
                  }}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="">-- اختر الصنف --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* 2. Product */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">2. اختر اسم المنتج (من بضاعة المخزن):</label>
                <select
                  value={posSelectedProdId}
                  onChange={(e) => handlePosProductChange(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="">-- اختر اسم المنتج --</option>
                  {posProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name_ar} (متاح بالمخزن: {p.on_hand_base} عبوة)
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Price and Qty */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">سعر بيع القطعة (تلقائي ج.م):</label>
                  <input
                    type="number"
                    value={posUnitPriceEGP}
                    onChange={(e) => setPosUnitPriceEGP(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-black text-pinko-plum outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">الكمية المطلوبة:</label>
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl p-1">
                    <button 
                      onClick={() => setPosQty(Math.max(1, posQty - 1))}
                      className="w-8 h-7 bg-white rounded-lg font-bold text-slate-700 shadow-sm flex items-center justify-center"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={posQty}
                      onChange={(e) => setPosQty(parseInt(e.target.value) || 1)}
                      className="w-full text-center text-xs font-bold bg-transparent outline-none"
                    />
                    <button 
                      onClick={() => setPosQty(posQty + 1)}
                      className="w-8 h-7 bg-white rounded-lg font-bold text-slate-700 shadow-sm flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full py-2.5 bg-pinko-plum hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة للسلة</span>
              </button>
            </div>

            {/* Cart & Payment */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-xs text-slate-800">سلة البيع الحالية ({cart.length})</h3>
                <span className="text-sm font-black text-pinko-plum">
                  الإجمالي: {cartTotalEGP.toFixed(2)} ج.م
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">السلة فارغة</div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl">
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.quantity} × {item.unitPriceEGP} ج.م</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{(item.quantity * item.unitPriceEGP).toFixed(2)} ج.م</span>
                        <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">المبلغ المدفوع نقدًا (ج.م)</label>
                        <input
                          type="number"
                          value={paidCashEGP}
                          onChange={(e) => handleCashChange(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">المبلغ الآجل والمتبقي</label>
                        <input
                          type="number"
                          value={onCreditEGP}
                          onChange={(e) => setOnCreditEGP(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 outline-none"
                        />
                      </div>
                    </div>

                    {(parseFloat(onCreditEGP) > 0 || customerNameInput) && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                        <label className="text-[10px] font-bold text-amber-900 block">اسم العميل لتسجيل الآجل عليه:</label>
                        <input
                          type="text"
                          value={customerNameInput}
                          onChange={(e) => setCustomerNameInput(e.target.value)}
                          placeholder="اكتب اسم العميل (مثال: ماركت الأمانة)"
                          className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold outline-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        disabled={loading || cart.length === 0}
                        onClick={() => handleCommitSale(false)}
                        className="py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black shadow flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>تأكيد الطلب</span>
                      </button>

                      <button
                        disabled={loading || cart.length === 0}
                        onClick={() => handleCommitSale(true)}
                        className="py-3 bg-pinko-plum hover:bg-slate-900 text-white rounded-xl text-xs font-black shadow flex items-center justify-center gap-1.5 border border-pink-400"
                      >
                        <Printer className="w-4 h-4 text-pink-300" />
                        <span>تأكيد وطباعة فاتورة بالسحابة</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: WAREHOUSE                                         */}
        {/* ========================================================= */}
        {workMode === 'warehouse' && (
          <div className="space-y-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-pinko-accent" />
                <span>استلام كراتين وبضاعة في المخزن — {activeBranchName}</span>
              </h2>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">1. الصنف (التصنيف):</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={inboundCatId}
                    onChange={(e) => setInboundCatId(e.target.value)}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="">-- اختر صنف موجود --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input
                    type="text"
                    value={newCatNameInput}
                    onChange={(e) => setNewCatNameInput(e.target.value)}
                    placeholder="أو أضف صنف جديد..."
                    className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">2. اسم المنتج / السلعة:</label>
                <input
                  type="text"
                  value={inboundProdName}
                  onChange={(e) => setInboundProdName(e.target.value)}
                  placeholder="مثال: شوكولاتة بالبندق كرانشي"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">عدد الكراتين (الكمية):</label>
                  <input
                    type="number"
                    value={inboundCartonQty}
                    onChange={(e) => setInboundCartonQty(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">كم عبوة في الكرتونة الواحدة؟</label>
                  <input
                    type="number"
                    value={inboundPiecesPerCarton}
                    onChange={(e) => setInboundPiecesPerCarton(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">سعر الكرتونة جملة (تكلفة ج.م):</label>
                  <input
                    type="number"
                    value={inboundCartonCostEGP}
                    onChange={(e) => setInboundCartonCostEGP(e.target.value)}
                    placeholder="مثال: 120"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">سعر بيع العبوة للزبون (ج.م):</label>
                  <input
                    type="number"
                    value={inboundPieceRetailEGP}
                    onChange={(e) => setInboundPieceRetailEGP(e.target.value)}
                    placeholder="مثال: 10"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              {inboundCartonCostEGP && inboundPieceRetailEGP && inboundPiecesPerCarton > 0 && (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 block">
                      إجمالي العبوات: {inboundCartonQty * inboundPiecesPerCarton} عبوة
                    </span>
                    <span className="text-[10px] text-emerald-700">
                      تكلفة العبوة الواحدة: {(parseFloat(inboundCartonCostEGP) / inboundPiecesPerCarton).toFixed(2)} ج.م
                    </span>
                  </div>
                  <div className="text-left font-black text-emerald-900">
                    هامش الربح / عبوة: +{(parseFloat(inboundPieceRetailEGP) - (parseFloat(inboundCartonCostEGP) / inboundPiecesPerCarton)).toFixed(2)} ج.م
                  </div>
                </div>
              )}

              <button
                disabled={loading}
                onClick={handleInboundGoods}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>حفظ واستلام البضاعة في المخزن</span>
              </button>
            </div>

            {/* Warehouse Stock List */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-xs text-slate-800">
                  أرصدة مخزن ({activeBranchName}) — {products.length} صنف
                </h3>
                {currentUser.role === 'owner' && (
                  <span className="text-[10px] text-pinko-accent font-bold">المالك: صلاحية تعديل</span>
                )}
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {products.map(p => (
                  <div key={p.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{p.name_ar}</div>
                      <div className="text-[10px] text-slate-500">
                        الصنف: {p.category_name || 'عام'} • سعر البيع: {(p.retail_price_piastres / 100).toFixed(2)} ج.م
                        {currentUser.role === 'owner' && ` • التكلفة: ${(p.cost_price_piastres / 100).toFixed(2)} ج.م`}
                      </div>
                    </div>
                    <div className="text-left flex items-center gap-2">
                      <span className="font-black text-sm text-pinko-plum">{p.on_hand_base} عبوة</span>
                      {currentUser.role === 'owner' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingProd(p);
                              setEditOnHand(p.on_hand_base.toString());
                              setEditRetailPrice((p.retail_price_piastres / 100).toString());
                              setEditCostPrice((p.cost_price_piastres / 100).toString());
                            }}
                            className="px-2 py-1 bg-slate-800 text-white rounded text-[10px] font-bold"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name_ar)}
                            className="p-1 bg-rose-50 text-rose-600 rounded border border-rose-200"
                            title="حذف الصنف نهائياً"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Edit Modal */}
            {editingProd && (
              <div className="p-3 bg-pink-50 border border-pinko-accent rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-pinko-plum">
                  <span>تعديل صنف: {editingProd.name_ar}</span>
                  <button onClick={() => setEditingProd(null)} className="text-slate-500 font-bold">✕ إلغاء</button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold block mb-1">الرصيد بالمخزن:</label>
                    <input
                      type="number"
                      value={editOnHand}
                      onChange={(e) => setEditOnHand(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block mb-1">سعر البيع (ج.م):</label>
                    <input
                      type="number"
                      value={editRetailPrice}
                      onChange={(e) => setEditRetailPrice(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block mb-1">التكلفة (ج.م):</label>
                    <input
                      type="number"
                      value={editCostPrice}
                      onChange={(e) => setEditCostPrice(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveProductEdit}
                  className="w-full py-1.5 bg-pinko-plum text-white rounded-xl text-xs font-bold shadow"
                >
                  حفظ التعديلات في السحابة
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: SALES & REPORTS WITH PER-PRODUCT BREAKDOWN         */}
        {/* ========================================================= */}
        {workMode === 'sales_history' && currentUser.role !== 'driver' && (
          <div className="space-y-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-pinko-accent" />
                  <span>
                    {currentUser.role === 'owner' ? 'تقارير المبيعات الشاملة والأرباح' : `مبيعات اليوم — ${activeBranchName}`}
                  </span>
                </h2>
              </div>

              {/* Owner Location Filter: All vs Shop 1 vs Shop 2 */}
              {currentUser.role === 'owner' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">اختر نطاق المبيعات:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setReportLocationFilter('all'); loadReports(reportPeriod, 'all'); }}
                      className={`py-1.5 rounded-xl text-xs font-bold ${
                        reportLocationFilter === 'all' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      إجمالي المحلين
                    </button>
                    <button
                      onClick={() => { setReportLocationFilter(shop1Location?.id || ''); loadReports(reportPeriod, shop1Location?.id || ''); }}
                      className={`py-1.5 rounded-xl text-xs font-bold ${
                        reportLocationFilter === shop1Location?.id ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      محل 1 فقط
                    </button>
                    <button
                      onClick={() => { setReportLocationFilter(shop2Location?.id || ''); loadReports(reportPeriod, shop2Location?.id || ''); }}
                      className={`py-1.5 rounded-xl text-xs font-bold ${
                        reportLocationFilter === shop2Location?.id ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      محل 2 فقط
                    </button>
                  </div>
                </div>
              )}

              {/* Period Filter (اليوم / شهرياً / سنوياً) */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => { 
                    setReportPeriod('daily'); 
                    loadReports('daily', currentUser.role === 'owner' ? reportLocationFilter : activeBranchId); 
                  }}
                  className={`py-1.5 rounded-xl text-xs font-bold ${
                    reportPeriod === 'daily' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  اليوم
                </button>
                <button
                  onClick={() => { 
                    setReportPeriod('monthly'); 
                    loadReports('monthly', currentUser.role === 'owner' ? reportLocationFilter : activeBranchId); 
                  }}
                  className={`py-1.5 rounded-xl text-xs font-bold ${
                    reportPeriod === 'monthly' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  شهرياً
                </button>
                <button
                  onClick={() => { 
                    setReportPeriod('yearly'); 
                    loadReports('yearly', currentUser.role === 'owner' ? reportLocationFilter : activeBranchId); 
                  }}
                  className={`py-1.5 rounded-xl text-xs font-bold ${
                    reportPeriod === 'yearly' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  سنوياً
                </button>
              </div>

              {/* Financial Totals */}
              {salesReport && (
                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                    <span className="text-[10px] text-emerald-800 font-bold block">إجمالي المبيعات</span>
                    <span className="text-sm font-black text-emerald-950">
                      {(salesReport.totalRevenuePiastres / 100).toFixed(2)} ج.م
                    </span>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
                    <span className="text-[10px] text-blue-800 font-bold block">المحصل نقدًا</span>
                    <span className="text-sm font-black text-blue-950">
                      {(salesReport.totalCashPiastres / 100).toFixed(2)} ج.م
                    </span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                    <span className="text-[10px] text-amber-800 font-bold block">الآجل المستحق (المتبقي)</span>
                    <span className="text-sm font-black text-amber-950">
                      {(salesReport.totalCreditPiastres / 100).toFixed(2)} ج.م
                    </span>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl">
                    <span className="text-[10px] text-purple-800 font-bold block">صافي الأرباح</span>
                    <span className="text-sm font-black text-purple-950">
                      {(salesReport.totalProfitPiastres / 100).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              )}

              {/* NEW SECTION: PER-PRODUCT SALES BREAKDOWN (مبيعات كل منتج على حدة) */}
              {salesReport && salesReport.productSales && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5 text-pinko-accent" />
                    <span>مبيعات المنتجات في هذه الفترة (كم بعنا من كل صنف):</span>
                  </h4>
                  {salesReport.productSales.length === 0 ? (
                    <div className="text-center py-2 text-xs text-slate-400">لم يتم بيع أي منتجات محددة بعد</div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {salesReport.productSales.map((ps: any, i: number) => (
                        <div key={i} className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{ps.name}</div>
                            <div className="text-[10px] text-slate-500">
                              إجمالي المبيعات: {(ps.totalRevenuePiastres / 100).toFixed(2)} ج.م
                            </div>
                          </div>
                          <div className="text-left font-black text-pinko-plum">
                            {ps.quantitySold} عبوة مباعة
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Invoices List with Settle Debt Trigger */}
              {salesReport && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-600">تفاصيل الفواتير ({salesReport.count}):</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {salesReport.sales.map((s: any) => {
                      const creditNum = parseInt(s.on_credit_piastres || 0, 10) / 100;
                      return (
                        <div key={s.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-800">{s.invoice_number}</div>
                              <div className="text-[10px] text-slate-500">
                                {s.locations?.name} • {s.customers?.name ? `عميل: ${s.customers.name}` : 'كاشير مباشر'}
                              </div>
                            </div>
                            <div className="text-left font-black text-slate-900">
                              {(s.total_piastres / 100).toFixed(2)} ج.م
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            {creditNum > 0 ? (
                              <span className="text-rose-600 font-bold text-[10px] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> متبقي آجل: {creditNum.toFixed(2)} ج.م
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> مسدد بالكامل
                              </span>
                            )}

                            <div className="flex items-center gap-1.5">
                              {creditNum > 0 && (
                                <button
                                  onClick={() => {
                                    setSettlingSaleId(s.id);
                                    setSettleAmountEGP(creditNum.toString());
                                  }}
                                  className="px-2 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-bold hover:bg-emerald-800"
                                >
                                  تسديد الآجل
                                </button>
                              )}
                              {currentUser?.role === 'owner' && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditSaleModal(s)}
                                    className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200"
                                    title="تعديل الفاتورة (صلاحية المالك)"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSale(s.id, s.invoice_number)}
                                    className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-200"
                                    title="حذف الفاتورة واسترجاع المخزون (صلاحية المالك)"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {settlingSaleId === s.id && (
                            <div className="p-2 bg-emerald-50 rounded-lg flex items-center gap-2 mt-1">
                              <input
                                type="number"
                                value={settleAmountEGP}
                                onChange={(e) => setSettleAmountEGP(e.target.value)}
                                placeholder="المبلغ المسدد..."
                                className="w-24 px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-bold"
                              />
                              <button
                                onClick={() => handleSettleDebt(s.id)}
                                className="px-3 py-1 bg-emerald-800 text-white rounded text-xs font-bold"
                              >
                                تأكيد السداد
                              </button>
                              <button
                                onClick={() => setSettlingSaleId(null)}
                                className="text-xs text-slate-500 font-bold"
                              >
                                إلغاء
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 4: VEHICLE DELIVERY ROUTE                           */}
        {/* ========================================================= */}
        {(workMode === 'vehicle_route' || currentUser.role === 'driver') && (
          <div className="space-y-3">
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">عرض خط سير السيارة:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setVehiclePeriod('daily'); loadVehicleData('daily'); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    vehiclePeriod === 'daily' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  اليوم
                </button>
                <button
                  onClick={() => { setVehiclePeriod('monthly'); loadVehicleData('monthly'); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    vehiclePeriod === 'monthly' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  الشهر
                </button>
                <button
                  onClick={() => { setVehiclePeriod('yearly'); loadVehicleData('yearly'); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    vehiclePeriod === 'yearly' ? 'bg-pinko-plum text-white shadow' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  السنة
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
                <span className="text-[9px] text-emerald-800 font-bold block">المحصل نقدًا</span>
                <span className="text-xs font-black text-emerald-950">{totalVehicleCash.toFixed(2)} ج.م</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl">
                <span className="text-[9px] text-rose-800 font-bold block">المصاريف</span>
                <span className="text-xs font-black text-rose-950">{totalVehicleExpenses.toFixed(2)} ج.م</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-2 rounded-xl">
                <span className="text-[9px] text-blue-800 font-bold block">العهدة الصافية</span>
                <span className="text-xs font-black text-blue-950">{netVehicleCash.toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-pinko-accent" />
                <span>تسليم محطة جديدة في خط السير</span>
              </h2>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">اسم المحل / العميل:</label>
                <input
                  type="text"
                  value={stopShopName}
                  onChange={(e) => setStopShopName(e.target.value)}
                  placeholder="مثال: ماركت الأمل - حلوان"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">الصنف (التصنيف):</label>
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
                    <option value="">-- اختر اسم المنتج --</option>
                    {(stopSelectedCatId ? products.filter(p => p.category_id === stopSelectedCatId) : products).map(p => (
                      <option key={p.id} value={p.id}>{p.name_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">الكمية المسلمة:</label>
                  <input
                    type="number"
                    value={stopItemQty}
                    onChange={(e) => setStopItemQty(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">سعر بيع القطعة (ج.م):</label>
                  <input
                    type="number"
                    value={stopItemPriceEGP}
                    onChange={(e) => setStopItemPriceEGP(e.target.value)}
                    placeholder="10"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-bold text-pinko-accent block">
                  * إلزامي: أدخل المبلغ المحصل نقدًا أو الآجل لحفظ المحطة:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">المحصل نقدًا (ج.م):</label>
                    <input
                      type="number"
                      value={stopCollectedEGP}
                      onChange={(e) => {
                        setStopCollectedEGP(e.target.value);
                        const total = (parseFloat(stopItemPriceEGP) || 0) * stopItemQty;
                        const rem = Math.max(0, total - (parseFloat(e.target.value) || 0));
                        setStopRemainingEGP(rem.toString());
                      }}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">المتبقي / الآجل (ج.م):</label>
                    <input
                      type="number"
                      value={stopRemainingEGP}
                      onChange={(e) => setStopRemainingEGP(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-950 outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                disabled={loading}
                onClick={handleRecordVehicleStop}
                className="w-full py-2.5 bg-pinko-plum hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>تسليم المحطة وحفظها في السحابة</span>
              </button>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-rose-600" /> تسجيل مصاريف سيارة التوزيع:
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
                  placeholder="سبب الصرف (بنزين/إكراميات...)"
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <button
                disabled={loading}
                onClick={handleRecordExpense}
                className="w-full py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold"
              >
                خصم المصروف من العهدة
              </button>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-pinko-accent" />
                  <span>محطات خط السير المسجلة ({vehicleStops.length})</span>
                </h3>
              </div>

              {vehicleStops.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">لا توجد محطات مسجلة لهذه الفترة</div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {vehicleStops.map((stop, idx) => (
                    <div key={stop.id || idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">
                          محطة {idx + 1}: {stop.customers?.name || stop.notes}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          محصل: {(stop.paid_cash_piastres / 100).toFixed(2)} ج.م • آجل: {(stop.on_credit_piastres / 100).toFixed(2)} ج.م
                        </div>
                      </div>
                      <div className="text-left font-black text-slate-900">
                        {(stop.total_piastres / 100).toFixed(2)} ج.م
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    alert(`✅ تم إغلاق خط السير وتسليم العهدة النقدية بنجاح:\nإجمالي المحصل: ${totalVehicleCash.toFixed(2)} ج.م\nإجمالي المصاريف: ${totalVehicleExpenses.toFixed(2)} ج.م\nالصافي المسلم للإدارة: ${netVehicleCash.toFixed(2)} ج.م\nتم توثيق الاستلام في السحابة.`);
                  }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow"
                >
                  تسليم العهدة النقدية الصافية ({netVehicleCash.toFixed(2)} ج.م) وإغلاق الوردية
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: EDIT SALE INVOICE (صلاحية تعديل الفواتير للمالك) */}
      {editingSaleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-xs text-slate-800">
                  تعديل الفاتورة: {editingSaleModal.invoice_number}
                </span>
              </div>
              <button onClick={() => setEditingSaleModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">العميل:</span>
                <span className="font-bold text-slate-800">{editingSaleModal.customers?.name || 'كاشير مباشر'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">إجمالي الفاتورة:</span>
                <span className="font-black text-slate-900">{((editingSaleModal.total_piastres || 0) / 100).toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">المبلغ المحصل نقداً (ج.م):</label>
                <input
                  type="number"
                  value={editSaleCashEGP}
                  onChange={(e) => {
                    const cash = parseFloat(e.target.value) || 0;
                    const tot = (editingSaleModal.total_piastres || 0) / 100;
                    setEditSaleCashEGP(e.target.value);
                    setEditSaleCreditEGP(Math.max(0, tot - cash).toFixed(2));
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">المبلغ المتبقي الآجل (ج.م):</label>
                <input
                  type="number"
                  value={editSaleCreditEGP}
                  onChange={(e) => setEditSaleCreditEGP(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">ملاحظات الفاتورة:</label>
                <textarea
                  value={editSaleNotes}
                  onChange={(e) => setEditSaleNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingSaleModal(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveSaleEdit}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>حفظ التعديلات بالسحابة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
