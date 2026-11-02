const fs = require('fs');
let code = fs.readFileSync('src/ui/AccountingModule.tsx', 'utf8');

// 1. إزالة جمل الـ if التي تدمر الشاشات
const oldIfs = `  if (mode === "customers" || mode === "suppliers") return <CustomersScreen kind={mode} onBack={goMenu} />;
  if (mode === "currencies") return <CurrenciesScreen onBack={goMenu} />;
  if (mode === "items") return <ItemsScreen onBack={goMenu} />;
  if (mode === "recipe") return <ProductRecipeScreen onBack={goMenu} />;
  if (mode === "production") return <ProductionOrderScreen onBack={goMenu} />;
  if (mode === "cashboxes") return <CashboxesScreen onBack={goMenu} />;
  if (mode === "accounts") return <AccountsScreen onBack={goMenu} />;
  if (mode === "salesReps") return <SalesRepsScreen onBack={goMenu} />;
  if (mode === "salesInvoice") return <SalesInvoiceScreen onBack={goMenu} />;
  if (mode === "purchaseInvoice") return <PurchaseInvoiceScreen onBack={goMenu} />;
  if (mode === "voucher") return <VouchersScreen onBack={goMenu} />;
  if (mode === "journal") return <JournalScreen onBack={goMenu} />;
  if (mode === "transfer") return <TransfersScreen onBack={goMenu} />;
  if (mode === "reports") return <ReportsIndex onBack={goMenu} />;
`;
code = code.replace(oldIfs, '');

// 2. إعادة هيكلة الـ return لتغليف كل شيء بـ View وإخفاء الشاشات بدلاً من حذفها
const oldReturnStart = `  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopContent]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>`;

const newReturnStart = `  return (
    <View style={{ flex: 1 }}>
      {/* 1. الشاشات التي نحتفظ بحالتها (لا يتم تدميرها) */}
      <View style={{ flex: 1, display: mode === "salesInvoice" ? "flex" : "none" }}>
        <SalesInvoiceScreen onBack={goMenu} />
      </View>
      <View style={{ flex: 1, display: mode === "purchaseInvoice" ? "flex" : "none" }}>
        <PurchaseInvoiceScreen onBack={goMenu} />
      </View>

      {/* 2. الشاشات الأخرى (تظهر وتختفي لتوفير الذاكرة) */}
      {mode === "customers" || mode === "suppliers" ? <CustomersScreen kind={mode} onBack={goMenu} /> : null}
      {mode === "currencies" ? <CurrenciesScreen onBack={goMenu} /> : null}
      {mode === "items" ? <ItemsScreen onBack={goMenu} /> : null}
      {mode === "recipe" ? <ProductRecipeScreen onBack={goMenu} /> : null}
      {mode === "production" ? <ProductionOrderScreen onBack={goMenu} /> : null}
      {mode === "cashboxes" ? <CashboxesScreen onBack={goMenu} /> : null}
      {mode === "accounts" ? <AccountsScreen onBack={goMenu} /> : null}
      {mode === "salesReps" ? <SalesRepsScreen onBack={goMenu} /> : null}
      {mode === "voucher" ? <VouchersScreen onBack={goMenu} /> : null}
      {mode === "journal" ? <JournalScreen onBack={goMenu} /> : null}
      {mode === "transfer" ? <TransfersScreen onBack={goMenu} /> : null}
      {mode === "reports" ? <ReportsIndex onBack={goMenu} /> : null}

      {/* 3. شاشة القائمة الرئيسية (تظهر فقط عند mode === "menu") */}
      {mode === "menu" && (
      <ScrollView contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopContent]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>`;

code = code.replace(oldReturnStart, newReturnStart);

// 3. إغلاق الـ ScrollView والـ View
const oldReturnEnd = `      ))}
    </ScrollView>
  );
}`;
const newReturnEnd = `      ))}
    </ScrollView>
      )}
    </View>
  );
}`;
code = code.replace(oldReturnEnd, newReturnEnd);

fs.writeFileSync('src/ui/AccountingModule.tsx', code);
console.log("✅ تم تفعيل الحفاظ على حالة الفواتير بنجاح!");
