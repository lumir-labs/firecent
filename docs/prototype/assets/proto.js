/* Shared by every screen.
 *
 * 1. Before first paint: reads ?theme=light|dark, ?state=data|empty|loading|error
 *    and ?sheet=<id> and copies them to <html>. The viewer (index.html) sets them
 *    on the iframe URL. Opened on its own, a screen defaults to light + data.
 * 2. On load: injects the pieces every screen shares (tab bar, desktop sidebar,
 *    toast) into <div data-shell></div>, then calls window.fableIcons(node).
 *      data-tab="home|transactions|assistant|more"   active tab (children of More use "more")
 *      data-nav="home|transactions|accounts|…"       active sidebar item
 *      data-tabbar="off"                             no tab bar (onboarding, assistant thread)
 *      data-sidebar="off"                            no sidebar (onboarding)
 * 3. Sheets: any element with data-sheet-id is hidden until <html data-sheet> names it.
 *    [data-open="id"] opens one, [data-close] closes it, Esc closes, focus is trapped.
 * 4. Prototype helpers: segmented controls (N5), chips (N4), toast (N12),
 *    desktop shortcuts, and the session scope (Everything / Shared / Only you). */
(function () {
  var params = new URLSearchParams(location.search);
  var root = document.documentElement;
  root.classList.toggle("dark", params.get("theme") === "dark");
  root.dataset.state = params.get("state") || "data";
  if (params.get("sheet")) root.dataset.sheet = params.get("sheet");

  // ── Templates ──────────────────────────────────────────────────────────────
  var TABS = [
    { id: "home", label: "Home", icon: "house", href: "home.html" },
    { id: "transactions", label: "Transactions", icon: "arrow-left-right", href: "transactions.html" },
    { id: "add" },
    { id: "assistant", label: "Assistant", icon: "firecent-mono", href: "assistant.html?view=new" },
    { id: "more", label: "More", icon: "layout-grid", href: "more.html" },
  ];

  function tabBar(active) {
    return (
      '<nav data-tabbar class="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[430px] border-t bg-card/85 backdrop-blur-xl lg:hidden" aria-label="Primary">' +
      '<ul class="grid grid-cols-5 px-2 pt-1.5 pb-7">' +
      TABS.map(function (t) {
        if (t.id === "add") {
          return (
            '<li class="flex justify-center">' +
            '<button type="button" data-open="add" class="-mt-5 grid size-14 place-items-center rounded-[20px] bg-primary text-primary-foreground shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] ring-4 ring-background" aria-label="Add a transaction">' +
            '<i data-icon="plus" data-stroke="2.25" class="size-7"></i>' +
            "</button></li>"
          );
        }
        var on = t.id === active;
        var icon = t.icon === "firecent-mono"
          ? '<i data-icon="firecent-mono" class="h-6 w-auto"></i>'
          : '<i data-icon="' + t.icon + '"' + (on ? ' data-stroke="2.25"' : "") + ' class="size-6"></i>';
        return (
          "<li>" +
          '<a href="' + t.href + '"' + (on ? ' aria-current="page"' : "") +
          ' class="flex h-12 flex-col items-center justify-center gap-1 ' + (on ? "text-primary-text" : "text-muted-foreground") + '">' +
          icon +
          '<span class="text-[11px] ' + (on ? "font-semibold" : "font-medium") + '">' + t.label + "</span>" +
          "</a></li>"
        );
      }).join("") +
      "</ul></nav>"
    );
  }

  var NAV = [
    { id: "home", label: "Home", icon: "house", href: "home.html" },
    { id: "transactions", label: "Transactions", icon: "arrow-left-right", href: "transactions.html" },
    { id: "accounts", label: "Accounts", icon: "wallet", href: "accounts.html" },
    { id: "budget", label: "Budget", icon: "target", href: "budget.html" },
    { id: "analytics", label: "Analytics", icon: "chart-column", href: "analytics.html" },
    { id: "recurring", label: "Recurring", icon: "repeat", href: "recurring.html" },
    { id: "debts", label: "Debts", icon: "hand-coins", href: "debts.html" },
    { sep: true },
    { id: "assistant", label: "Assistant", icon: "firecent-mono", href: "assistant.html?view=thread" },
    { sep: true },
    { id: "settings", label: "Settings", icon: "settings", href: "more.html" },
  ];

  function sidebar(active) {
    var items = '<ul class="space-y-0.5">';
    NAV.forEach(function (n) {
      if (n.sep) { items += '</ul><div class="my-3 border-t"></div><ul class="space-y-0.5">'; return; }
      var on = n.id === active;
      var icon = n.icon === "firecent-mono"
        ? '<i data-icon="firecent-mono" class="h-[18px] w-auto"></i>'
        : '<i data-icon="' + n.icon + '" class="size-[18px]"></i>';
      items +=
        '<li><a href="' + n.href + '"' + (on ? ' aria-current="page"' : "") +
        ' class="flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium ' +
        (on ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground") + '">' +
        icon + n.label + "</a></li>";
    });
    items += "</ul>";
    return (
      '<aside data-sidebar class="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r bg-sidebar px-3 py-4 lg:flex" aria-label="Sidebar">' +
      '<a href="home.html" class="flex h-11 items-center rounded-xl px-2 text-foreground hover:bg-accent/50" aria-label="Firecent Home">' +
      '<i data-icon="firecent-logo" class="h-8 w-auto"></i></a>' +
      '<button type="button" data-open="add" class="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground">' +
      '<i data-icon="plus" class="size-4"></i>Add transaction</button>' +
      '<nav class="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Primary">' + items + "</nav>" +
      '<div class="mt-3 space-y-1 border-t pt-3">' +
      '<button type="button" data-open="space" class="flex h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-[13px] font-medium hover:bg-accent">' +
      '<span class="flex min-w-0 items-center gap-2">' +
      '<span class="inline-flex shrink-0 -space-x-1.5" aria-hidden="true">' +
      '<span class="grid size-6 place-items-center rounded-full bg-brand-purple text-[11px] font-semibold text-brand-purple-foreground ring-2 ring-sidebar">M</span>' +
      '<span class="grid size-6 place-items-center rounded-full bg-brand-orange text-[11px] font-semibold text-brand-orange-foreground ring-2 ring-sidebar">D</span></span>' +
      '<span class="truncate" data-space-name>Maya &amp; Daniel</span></span>' +
      '<i data-icon="chevrons-up-down" class="size-3.5 shrink-0 text-muted-foreground"></i></button>' +
      '<a href="more.html" class="flex h-10 items-center gap-2.5 rounded-lg px-2 text-[14px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">' +
      '<span class="grid size-6 shrink-0 place-items-center rounded-full bg-brand-purple text-[11px] font-semibold text-brand-purple-foreground" aria-hidden="true">M</span>' +
      '<span class="truncate">Maya Torres</span></a>' +
      "</div>" +
      "</aside>"
    );
  }

  function toast() {
    return (
      '<div data-toast role="status" aria-live="polite" class="fixed inset-x-4 bottom-24 z-50 mx-auto hidden max-w-[398px] items-center justify-between gap-3 rounded-2xl bg-foreground px-4 py-3 text-[14px] text-background shadow-lg lg:right-8 lg:bottom-8 lg:left-auto lg:w-[360px]">' +
      '<span data-toast-text></span>' +
      '<button type="button" data-toast-action class="-my-2 -mr-2 flex h-11 items-center px-2 font-semibold"></button>' +
      "</div>"
    );
  }

  // ── 5.3 Add transaction (?sheet=add) ───────────────────────────────────────
  var EXP_CATS = [
    { id: "Groceries", icon: "shopping-cart", color: "green" },
    { id: "Dining out", icon: "utensils", color: "orange" },
    { id: "Transport", icon: "bus", color: "blue" },
    { id: "Shopping", icon: "shopping-bag", color: "purple" },
    { id: "Entertainment", icon: "ticket", color: "pink" },
    { id: "Health", icon: "heart-pulse", color: "green" },
    { id: "Household", icon: "lamp", color: "yellow" },
    { id: "MORE", label: "More", icon: "ellipsis", color: "gray" },
  ];
  var INC_CATS = [
    { id: "Paycheck", icon: "briefcase", color: "green" },
    { id: "Other income", icon: "coins", color: "green" },
  ];
  var ALL_CATS_GROUPS = [
    { group: "Everyday", items: [
      { id: "Groceries", icon: "shopping-cart", color: "green" },
      { id: "Dining out", icon: "utensils", color: "orange" },
      { id: "Transport", icon: "bus", color: "blue" },
      { id: "Household", icon: "lamp", color: "yellow" },
      { id: "Pets", icon: "paw-print", color: "gray" },
    ]},
    { group: "Housing, Bills & Loans", items: [
      { id: "Rent", icon: "building-2", color: "purple" },
      { id: "Utilities", icon: "zap", color: "yellow" },
      { id: "Phone & internet", icon: "wifi", color: "blue" },
      { id: "Insurance", icon: "shield", color: "blue" },
      { id: "Car loan", icon: "car", color: "red" },
      { id: "Student loan", icon: "graduation-cap", color: "gray" },
    ]},
    { group: "Lifestyle & Health", items: [
      { id: "Shopping", icon: "shopping-bag", color: "purple" },
      { id: "Entertainment", icon: "ticket", color: "pink" },
      { id: "Subscriptions", icon: "tv", color: "purple" },
      { id: "Health", icon: "heart-pulse", color: "green" },
      { id: "Fitness", icon: "dumbbell", color: "green" },
      { id: "Gifts", icon: "gift", color: "orange" },
    ]},
  ];
  var ADD_ACCOUNTS = [
    { id: "JC", name: "Joint Checking", card: false, currency: "USD" },
    { id: "SR", name: "Sapphire Reserve", card: true, currency: "USD" },
    { id: "AG", name: "Amex Gold", card: true, currency: "USD" },
    { id: "MC", name: "Maya's Checking", card: false, currency: "USD" },
    { id: "BB", name: "BBVA México", card: false, currency: "MXN" },
  ];

  function addSheet() {
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
    return (
      '<div data-sheet-id="add">' +
      '<div data-veil data-close class="fixed inset-0 z-40 bg-[#0b1220]/50"></div>' +
      '<div role="dialog" aria-modal="true" aria-label="Add transaction" class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] max-w-[430px] overflow-y-auto rounded-t-3xl bg-card pb-4 shadow-[0_-8px_30px_-12px_rgb(11_18_32/0.25)] lg:top-1/2 lg:right-auto lg:bottom-auto lg:left-1/2 lg:w-[480px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border lg:pb-6">' +
      '<div class="mx-auto mt-2.5 h-1 w-9 rounded-full bg-muted-foreground/30 lg:hidden"></div>' +
      // 1 · Segmented control + Close
      '<div class="flex items-center gap-2 px-5 pt-3">' +
      '<div data-seg id="add-mode" class="flex h-11 flex-1 rounded-xl bg-muted p-1" role="group" aria-label="Transaction type">' +
      '<button type="button" data-value="EXPENSE" aria-pressed="true" class="flex-1 rounded-lg bg-card text-[14px] font-medium text-foreground shadow-[0_1px_2px_rgb(11_18_32/0.12)]">Expense</button>' +
      '<button type="button" data-value="INCOME" aria-pressed="false" class="flex-1 rounded-lg text-[14px] font-medium text-muted-foreground">Income</button>' +
      '<button type="button" data-value="TRANSFER" aria-pressed="false" class="flex-1 rounded-lg text-[14px] font-medium text-muted-foreground">Transfer</button>' +
      "</div>" +
      '<button type="button" data-close class="grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent" aria-label="Close">' +
      '<i data-icon="x" class="size-[22px]"></i></button>' +
      "</div>" +
      // 2 · Amount hero
      '<div class="py-5 text-center">' +
      '<p id="add-amount-display" class="num text-[34px] leading-[40px] font-semibold tracking-[-0.03em] text-muted-foreground/70 lg:hidden">$0.00</p>' +
      '<input id="add-amount-input" type="text" inputmode="decimal" autofocus placeholder="$0.00" aria-label="Amount" class="num hidden w-full bg-transparent text-center text-[34px] leading-[40px] font-semibold tracking-[-0.03em] placeholder:text-muted-foreground/70 focus:outline-none lg:block" />' +
      '<p id="add-currency-note" class="mt-1 hidden text-[13px] text-muted-foreground">Mexican pesos</p>' +
      "</div>" +
      // 3 · Repeat chips
      '<div id="add-repeat-wrap">' +
      '<p class="px-5 text-[12px] text-muted-foreground">Repeat</p>' +
      '<div class="mt-1.5 flex gap-2 overflow-x-auto px-5">' +
      '<button type="button" data-repeat="0" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium hover:bg-accent after:absolute after:inset-x-0 after:-inset-y-1 after:content-[\'\']"><span class="num">Blue Bottle · $6.75</span></button>' +
      '<button type="button" data-repeat="1" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium hover:bg-accent after:absolute after:inset-x-0 after:-inset-y-1 after:content-[\'\']">Trader Joe\'s</button>' +
      '<button type="button" data-repeat="2" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium hover:bg-accent after:absolute after:inset-x-0 after:-inset-y-1 after:content-[\'\']"><span class="num">MTA OMNY · $34.00</span></button>' +
      "</div></div>" +
      // Desktop category combobox (Tab target after amount input)
      '<div id="add-combo-wrap" class="mt-3 hidden px-5 lg:block">' +
      '<input id="add-cat-combo" type="text" placeholder="Category (pick below or type)" aria-label="Category" class="h-10 w-full rounded-xl border border-input bg-card px-3.5 text-[14px] placeholder:text-muted-foreground" />' +
      "</div>" +
      // 4 · Category grid (8 cells in Expense, 2 in Income)
      '<div id="add-cats" class="mt-2.5 grid grid-cols-4 gap-2 px-5" role="group" aria-label="Categories"></div>' +
      // Expanded "More" category list with search
      '<div id="add-more-cats" class="mt-2.5 hidden space-y-3 px-5">' +
      '<input type="search" id="add-cat-search" placeholder="Search categories" aria-label="Search categories" class="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[16px] placeholder:text-muted-foreground" />' +
      '<div id="add-more-cats-list" class="max-h-48 space-y-3 overflow-y-auto"></div>' +
      "</div>" +
      // Transfer fields (shown when mode = TRANSFER)
      '<div id="add-transfer-wrap" class="mt-2 hidden space-y-3 px-5">' +
      '<div class="divide-y rounded-2xl border bg-card">' +
      '<button type="button" id="add-tf-from" class="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left hover:bg-accent/60">' +
      '<span class="text-muted-foreground">From</span>' +
      '<span class="flex items-center gap-1.5 font-medium"><span id="add-tf-from-val">Maya\'s Checking</span> <i data-icon="chevron-right" class="size-4 text-muted-foreground"></i></span>' +
      "</button>" +
      '<button type="button" id="add-tf-to" class="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left hover:bg-accent/60">' +
      '<span class="text-muted-foreground">To</span>' +
      '<span class="flex items-center gap-1.5 font-medium"><span id="add-tf-to-val">Joint Checking</span> <i data-icon="chevron-right" class="size-4 text-muted-foreground"></i></span>' +
      "</button>" +
      "</div>" +
      '<div id="add-tf-fx" class="hidden">' +
      '<label for="add-tf-receive" class="mb-1.5 block text-[13px] font-medium">They receive</label>' +
      '<input id="add-tf-receive" type="text" value="MX$761.70" class="num h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[16px]" />' +
      '<p class="num mt-1.5 text-[12px] text-muted-foreground">1 USD = 18.47 MXN</p>' +
      "</div></div>" +
      // 5 · Context chips
      '<div id="add-context-wrap" class="mt-2.5 flex gap-2 overflow-x-auto px-5">' +
      '<button type="button" id="add-acc-chip" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium hover:bg-accent after:absolute after:inset-x-0 after:-inset-y-1 after:content-[\'\']"><span id="add-acc-label">Joint Checking</span><i data-icon="chevron-down" class="size-3.5 text-muted-foreground"></i></button>' +
      '<button type="button" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium hover:bg-accent after:absolute after:inset-x-0 after:-inset-y-1 after:content-[\'\']">Today</button>' +
      '<button type="button" id="add-note-chip" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium hover:bg-accent after:absolute after:inset-x-0 after:-inset-y-1 after:content-[\'\']">Add note</button>' +
      "</div>" +
      // 6 · Numeric keypad N9 (mobile only)
      '<div class="mt-2 grid grid-cols-3 gap-1 px-3 lg:hidden" role="group" aria-label="Numeric keypad">' +
      keys.map(function (k) {
        if (k === "del") {
          return '<button type="button" data-key="del" class="grid h-14 place-items-center rounded-xl text-[22px] font-medium active:bg-accent" aria-label="Delete"><i data-icon="delete" class="size-6"></i></button>';
        }
        return '<button type="button" data-key="' + k + '" class="num h-14 rounded-xl text-[22px] font-medium active:bg-accent">' + k + "</button>";
      }).join("") +
      "</div>" +
      // Save error notice (4.1, hidden unless triggered)
      '<div id="add-save-error" class="mx-5 mt-2 hidden items-start gap-2.5 rounded-xl bg-warning/12 px-3.5 py-3 text-[13px] leading-[19px]">' +
      '<i data-icon="circle-alert" class="mt-0.5 size-4 shrink-0 text-warning"></i>' +
      "<span>Couldn't save. Your entry is still here.</span></div>" +
      // 7 · Primary Save button
      '<div class="mx-5 mt-2">' +
      '<button type="button" id="add-save" disabled class="num inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">Save</button>' +
      '<p id="add-transfer-disclaimer" class="mt-2 hidden text-center text-[12px] text-muted-foreground">This records it in Firecent. It does not move money at your bank.</p>' +
      "</div>" +
      // 8 · More details
      '<div id="add-more-wrap" class="mt-1 flex flex-col items-center">' +
      '<button type="button" id="add-more-btn" class="flex h-11 items-center rounded-xl px-3 text-[14px] font-medium text-primary-text">More details</button>' +
      "</div>" +
      '<div id="add-details-panel" class="mt-2 hidden space-y-3 px-5">' +
      '<div><label for="add-payee" class="mb-1.5 block text-[13px] font-medium">Payee</label>' +
      '<input id="add-payee" type="text" placeholder="e.g. DoorDash" class="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[16px] placeholder:text-muted-foreground" /></div>' +
      '<div><label for="add-note" class="mb-1.5 block text-[13px] font-medium">Note</label>' +
      '<input id="add-note" type="text" placeholder="Optional note" class="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[16px] placeholder:text-muted-foreground" /></div>' +
      '<div><p class="mb-1.5 block text-[13px] font-medium">Labels</p>' +
      '<div data-chips="multi" class="flex flex-wrap gap-2">' +
      '<button type="button" data-value="Reimbursable" aria-pressed="false" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium">Reimbursable</button>' +
      '<button type="button" data-value="Trip: Lisbon" aria-pressed="false" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium">Trip: Lisbon</button>' +
      '<button type="button" data-value="Tax" aria-pressed="false" class="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium">Tax</button>' +
      "</div></div>" +
      '<div id="add-installments-row" class="hidden rounded-2xl border bg-card p-4">' +
      '<button type="button" id="add-inst-switch" role="switch" aria-checked="false" class="flex w-full items-center justify-between gap-3 text-left">' +
      '<span class="font-medium">Pay in installments</span>' +
      '<span class="relative h-7 w-12 rounded-full bg-input transition-colors"><span data-knob class="absolute top-0.5 left-0.5 size-6 rounded-full bg-white transition-transform"></span></span>' +
      "</button>" +
      '<div id="add-inst-options" class="mt-3 hidden space-y-3 border-t pt-3">' +
      '<div data-chips="single" id="add-inst-months" class="flex flex-wrap gap-1.5">' +
      ["3", "6", "9", "12", "18", "24"].map(function (m) {
        var on = m === "6";
        return '<button type="button" data-value="' + m + '" aria-pressed="' + on + '" class="num relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] font-medium ' + (on ? "border-transparent bg-foreground text-background" : "bg-card") + '">' + m + " mo</button>";
      }).join("") +
      "</div>" +
      '<button type="button" id="add-zero-switch" role="switch" aria-checked="true" class="flex w-full items-center justify-between gap-3 text-left text-[14px]">' +
      '<span class="text-muted-foreground">0% interest</span>' +
      '<span class="relative h-7 w-12 rounded-full bg-primary transition-colors"><span class="absolute top-0.5 left-5.5 size-6 rounded-full bg-white transition-transform"></span></span>' +
      "</button>" +
      '<p id="add-inst-summary" class="num text-[13px] text-muted-foreground">$74.99 a month for 6 months</p>' +
      "</div></div></div>" +
      "</div></div>"
    );
  }

  // ── Segmented controls (N5) and chips (N4) ─────────────────────────────────
  var SEG_ON = ["bg-card", "text-foreground", "shadow-[0_1px_2px_rgb(11_18_32/0.12)]"];
  var SEG_OFF = ["text-muted-foreground"];
  var CHIP_ON = ["border-transparent", "bg-foreground", "text-background"];
  var CHIP_OFF = ["bg-card"];

  function press(btn, on, onCls, offCls) {
    btn.setAttribute("aria-pressed", String(on));
    onCls.forEach(function (c) { btn.classList.toggle(c, on); });
    offCls.forEach(function (c) { btn.classList.toggle(c, !on); });
  }

  document.addEventListener("click", function (e) {
    var seg = e.target.closest("[data-seg] > button");
    if (seg && !seg.disabled) {
      seg.parentElement.querySelectorAll(":scope > button").forEach(function (b) { press(b, b === seg, SEG_ON, SEG_OFF); });
      seg.parentElement.dispatchEvent(new CustomEvent("fable:change", { bubbles: true, detail: seg.dataset.value }));
    }
    var chip = e.target.closest("[data-chips] button[aria-pressed]");
    if (chip && !chip.disabled) {
      var group = chip.closest("[data-chips]");
      if (group.dataset.chips === "multi") press(chip, chip.getAttribute("aria-pressed") !== "true", CHIP_ON, CHIP_OFF);
      else group.querySelectorAll("button[aria-pressed]").forEach(function (b) { press(b, b === chip, CHIP_ON, CHIP_OFF); });
      group.dispatchEvent(new CustomEvent("fable:change", { bubbles: true, detail: chip.dataset.value }));
    }
  });

  // ── Session scope (D5): Everything / Shared / Only you ─────────────────────
  window.fableScope = function (value) {
    try {
      if (value) sessionStorage.setItem("fable-scope", value);
      return params.get("scope") || sessionStorage.getItem("fable-scope") || "everything";
    } catch (err) {
      return value || params.get("scope") || "everything";
    }
  };
  window.fableSpace = function (value) {
    try {
      if (value) sessionStorage.setItem("fable-space", value);
      return params.get("space") || sessionStorage.getItem("fable-space") || "Maya & Daniel";
    } catch (err) {
      return value || params.get("space") || "Maya & Daniel";
    }
  };

  // ── Shared Space selector (?sheet=space) & Desktop Ask drawer (?sheet=ask) ─
  function spaceSheet() {
    var spaces = [
      { id: "Maya & Daniel", sub: "2 members · Shared books", badges: ["M", "D"], cls: ["bg-brand-purple text-brand-purple-foreground", "bg-brand-orange text-brand-orange-foreground"] },
      { id: "Personal", sub: "Just you · No accounts added", badges: ["M"], cls: ["bg-brand-purple text-brand-purple-foreground"] },
      { id: "Torres family", sub: "4 members · Shared vacation fund", badges: ["M", "T"], cls: ["bg-brand-blue text-brand-blue-foreground", "bg-brand-green text-brand-green-foreground"] },
    ];
    return (
      '<div data-sheet-id="space">' +
      '<div data-veil data-close class="fixed inset-0 z-40 bg-[#0b1220]/50"></div>' +
      '<div role="dialog" aria-modal="true" aria-label="Switch space" class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] max-w-[430px] overflow-y-auto rounded-t-3xl bg-card pb-6 shadow-[0_-8px_30px_-12px_rgb(11_18_32/0.25)] lg:top-1/2 lg:right-auto lg:bottom-auto lg:left-1/2 lg:w-[460px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border">' +
      '<div class="mx-auto mt-2.5 h-1 w-9 rounded-full bg-muted-foreground/30 lg:hidden"></div>' +
      '<div class="flex items-center justify-between gap-2 px-5 pt-4">' +
      '<div><h2 class="text-[18px] leading-6 font-semibold tracking-[-0.01em]">Spaces</h2><p class="text-[13px] text-muted-foreground">Each space keeps its own accounts, categories, and members.</p></div>' +
      '<button type="button" data-close class="grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent" aria-label="Close"><i data-icon="x" class="size-[22px]"></i></button>' +
      "</div>" +
      '<div id="space-sheet-list" class="mt-4 divide-y px-5">' +
      spaces.map(function (sp) {
        var icons = sp.badges.map(function (b, idx) {
          return '<span class="grid size-8 place-items-center rounded-full text-[12px] font-semibold ring-2 ring-card ' + sp.cls[idx] + '">' + b + "</span>";
        }).join("");
        return (
          '<button type="button" data-pick-space="' + sp.id + '" class="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left">' +
          '<span class="flex min-w-0 items-center gap-3">' +
          '<span class="inline-flex shrink-0 -space-x-2" aria-hidden="true">' + icons + "</span>" +
          '<span class="min-w-0"><span class="block truncate font-semibold">' + sp.id + '</span><span class="block text-[13px] text-muted-foreground">' + sp.sub + "</span></span></span>" +
          '<i data-icon="check" class="size-4 shrink-0 text-primary-text opacity-0" data-space-check></i>' +
          "</button>"
        );
      }).join("") +
      "</div>" +
      '<div class="mt-3 space-y-2.5 border-t px-5 pt-4">' +
      '<button type="button" id="space-new-toggle" class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 text-[14px] font-medium hover:bg-accent">' +
      '<i data-icon="plus" class="size-4"></i>New space</button>' +
      '<div id="space-new-form" class="hidden space-y-3 rounded-2xl border bg-muted/40 p-3.5">' +
      '<input id="space-new-name" type="text" placeholder="Space name (e.g. Lisbon trip)" aria-label="Space name" class="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] placeholder:text-muted-foreground" />' +
      '<div class="flex gap-2">' +
      '<button type="button" id="space-new-save" class="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary px-3 text-[13px] font-semibold text-primary-foreground">Create space</button>' +
      '<button type="button" id="space-new-cancel" class="inline-flex h-10 items-center justify-center rounded-xl border bg-card px-3 text-[13px] font-medium hover:bg-accent">Cancel</button>' +
      "</div></div>" +
      '<a href="members.html" class="flex h-10 items-center justify-between rounded-xl px-2 text-[14px] font-medium text-primary-text hover:bg-accent/60">' +
      '<span>Manage members &amp; sharing</span><i data-icon="chevron-right" class="size-4"></i></a>' +
      "</div></div></div>"
    );
  }

  function askSheet() {
    var prompts = [
      { q: "Did we stay under our $900 Groceries limit?", a: "Yes — $709.46 spent (79% of your $900 cap), leaving $190.54 for the last 18 days of November." },
      { q: "Which category limits are above 40% pace?", a: "Four limits are above 40% pace: Entertainment (85%, $212.09 / $250), Transport (83%), Groceries (79%), and Dining out (70%)." },
      { q: "When is Sapphire Reserve due?", a: "Nov 15 (3 days away) for $1,512.80, paid automatically from Joint Checking (balance $8,420.55)." },
    ];
    return (
      '<div data-sheet-id="ask">' +
      '<div data-veil data-close class="fixed inset-0 z-40 bg-[#0b1220]/50"></div>' +
      '<div role="dialog" aria-modal="true" aria-label="Ask Firecent" class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] max-w-[430px] overflow-y-auto rounded-t-3xl bg-card pb-6 shadow-[0_-8px_30px_-12px_rgb(11_18_32/0.25)] lg:top-1/2 lg:right-auto lg:bottom-auto lg:left-1/2 lg:w-[500px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border">' +
      '<div class="mx-auto mt-2.5 h-1 w-9 rounded-full bg-muted-foreground/30 lg:hidden"></div>' +
      '<div class="flex items-center justify-between gap-2 px-5 pt-4">' +
      '<div class="flex items-center gap-2.5">' +
      '<span class="grid size-8 place-items-center rounded-xl bg-primary/12 text-primary-text"><i data-icon="firecent-mono" class="h-4 w-auto"></i></span>' +
      '<div><h2 class="text-[18px] leading-6 font-semibold tracking-[-0.01em]">Ask Firecent</h2><p class="text-[12px] text-muted-foreground">Reads only the accounts you see</p></div>' +
      "</div>" +
      '<button type="button" data-close class="grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent" aria-label="Close"><i data-icon="x" class="size-[22px]"></i></button>' +
      "</div>" +
      '<div class="mt-4 space-y-2 px-5">' +
      '<p class="text-[12px] font-medium text-muted-foreground">Try asking</p>' +
      prompts.map(function (p, i) {
        return '<button type="button" data-ask-quick="' + i + '" class="flex w-full items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-left text-[14px] font-medium hover:bg-accent/70"><span>' + p.q + '</span><i data-icon="arrow-up-right" class="size-4 shrink-0 text-muted-foreground"></i></button>';
      }).join("") +
      "</div>" +
      '<div id="ask-quick-reply" class="mx-5 mt-3 hidden rounded-2xl border bg-accent/50 p-4 text-[14px] leading-[21px]">' +
      '<p id="ask-quick-q" class="text-[12px] font-semibold text-primary-text"></p>' +
      '<p id="ask-quick-a" class="mt-1 text-foreground"></p>' +
      '<a href="assistant.html?view=thread" class="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary-text hover:underline">Continue in Assistant<i data-icon="chevron-right" class="size-3.5"></i></a>' +
      "</div>" +
      '<form id="ask-quick-form" class="mt-4 px-5">' +
      '<div class="flex items-center gap-2 rounded-2xl border bg-background px-3 py-1.5">' +
      '<input id="ask-quick-input" type="text" placeholder="Ask about categories, caps, or accounts..." aria-label="Question" class="h-10 min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-muted-foreground focus:outline-none" />' +
      '<button type="submit" class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" aria-label="Ask"><i data-icon="arrow-up" class="size-4"></i></button>' +
      "</div>" +
      '<div class="mt-3 flex items-center justify-between text-[13px] text-muted-foreground">' +
      '<span>Need charts or file import?</span>' +
      '<a href="assistant.html?view=thread" class="font-medium text-primary-text hover:underline">Open full Assistant</a>' +
      "</div></form></div></div>"
    );
  }

  function setupSpaceSheet() {
    var sheet = document.querySelector('[data-sheet-id="space"]');
    if (!sheet) return;
    function syncSpace() {
      var cur = window.fableSpace();
      document.querySelectorAll("[data-space-name]").forEach(function (el) { el.textContent = cur; });
      sheet.querySelectorAll("[data-pick-space]").forEach(function (btn) {
        var on = btn.dataset.pickSpace === cur;
        var chk = btn.querySelector("[data-space-check]");
        if (chk) chk.classList.toggle("opacity-0", !on);
      });
    }
    sheet.addEventListener("click", function (e) {
      var pick = e.target.closest("[data-pick-space]");
      if (pick) {
        var next = pick.dataset.pickSpace;
        window.fableSpace(next);
        syncSpace();
        window.fableClose();
        window.fableToast("Switched to " + next);
      }
    });
    var form = document.getElementById("space-new-form");
    var toggle = document.getElementById("space-new-toggle");
    var input = document.getElementById("space-new-name");
    if (toggle && form) {
      toggle.addEventListener("click", function () {
        form.classList.remove("hidden");
        toggle.classList.add("hidden");
        if (input) input.focus();
      });
    }
    var cancel = document.getElementById("space-new-cancel");
    if (cancel && form && toggle) {
      cancel.addEventListener("click", function () {
        form.classList.add("hidden");
        toggle.classList.remove("hidden");
      });
    }
    var save = document.getElementById("space-new-save");
    if (save && input) {
      save.addEventListener("click", function () {
        var name = (input.value || "").trim() || "New space";
        window.fableSpace(name);
        syncSpace();
        window.fableClose();
        window.fableToast("Created space · " + name);
      });
    }
    syncSpace();
  }

  function setupAskSheet() {
    var sheet = document.querySelector('[data-sheet-id="ask"]');
    if (!sheet) return;
    var ANSWERS = [
      { q: "Did we stay under our $900 Groceries limit?", a: "Yes — $709.46 spent (79% of your $900 cap), leaving $190.54 for the last 18 days of November." },
      { q: "Which category limits are above 40% pace?", a: "Four limits are above 40% pace: Entertainment (85%, $212.09 / $250), Transport (83%), Groceries (79%), and Dining out (70%)." },
      { q: "When is Sapphire Reserve due?", a: "Nov 15 (3 days away) for $1,512.80, paid automatically from Joint Checking (balance $8,420.55)." },
    ];
    sheet.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-ask-quick]");
      if (!btn) return;
      var item = ANSWERS[Number(btn.dataset.askQuick) || 0];
      if (!item) return;
      document.getElementById("ask-quick-q").textContent = item.q;
      document.getElementById("ask-quick-a").textContent = item.a;
      document.getElementById("ask-quick-reply").classList.remove("hidden");
    });
    var form = document.getElementById("ask-quick-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = (document.getElementById("ask-quick-input").value || "").trim();
        if (!v) { location.href = "assistant.html?view=thread"; return; }
        document.getElementById("ask-quick-q").textContent = v;
        document.getElementById("ask-quick-a").textContent = "Across your visible accounts, November capped spending is $4,317.00 of $5,580.00 across 12 limits ($1,263.00 left for 18 days, plus $495.14 in 5 uncapped categories).";
        document.getElementById("ask-quick-reply").classList.remove("hidden");
        document.getElementById("ask-quick-input").value = "";
      });
    }
  }

  // ── Toast (N12) ────────────────────────────────────────────────────────────
  var toastTimer;
  window.fableToast = function (text, action, onAction) {
    var el = document.querySelector("[data-toast]");
    if (!el) return;
    el.querySelector("[data-toast-text]").textContent = text;
    var btn = el.querySelector("[data-toast-action]");
    btn.textContent = action || "";
    btn.hidden = !action;
    btn.onclick = function () { hideToast(); if (onAction) onAction(); };
    el.classList.remove("hidden");
    el.classList.add("flex");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  };
  function hideToast() {
    var el = document.querySelector("[data-toast]");
    if (el) { el.classList.add("hidden"); el.classList.remove("flex"); }
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-toast-msg]");
    if (t) window.fableToast(t.dataset.toastMsg, t.dataset.toastAction);
  });

  // ── Sheets ─────────────────────────────────────────────────────────────────
  var opener = null;
  function sheetEl(id) { return id ? document.querySelector('[data-sheet-id="' + id + '"]') : null; }
  function syncUrl() {
    var p = new URLSearchParams(location.search);
    if (root.dataset.sheet) p.set("sheet", root.dataset.sheet); else p.delete("sheet");
    var q = p.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
  }
  function focusables(el) {
    return Array.prototype.filter.call(
      el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'),
      function (n) { return n.offsetParent !== null; },
    );
  }
  window.fableOpen = function (id, from) {
    if (!sheetEl(id)) return;
    opener = from || document.activeElement;
    root.dataset.sheet = id;
    syncUrl();
    var f = focusables(sheetEl(id));
    var first = sheetEl(id).querySelector("[autofocus]") || f[0];
    if (first) first.focus({ preventScroll: true });
  };
  window.fableClose = function () {
    delete root.dataset.sheet;
    syncUrl();
    if (opener && opener.focus) opener.focus({ preventScroll: true });
    opener = null;
  };
  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-open]");
    if (o) { e.preventDefault(); window.fableOpen(o.dataset.open, o); return; }
    var c = e.target.closest("[data-close]");
    if (c) { e.preventDefault(); window.fableClose(); }
  });

  // ── Keyboard: Esc, focus trap, desktop shortcuts ───────────────────────────
  var GO = { h: "home.html", t: "transactions.html", a: "accounts.html", b: "budget.html", y: "analytics.html", r: "recurring.html", d: "debts.html" };
  var gPending = 0;
  document.addEventListener("keydown", function (e) {
    var open = sheetEl(root.dataset.sheet);
    if (e.key === "Escape" && open) { e.preventDefault(); window.fableClose(); return; }
    if (e.key === "Tab" && open) {
      var f = focusables(open);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      return;
    }
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (typing || open || e.metaKey || e.ctrlKey || e.altKey || window.innerWidth < 1024) return;
    var k = e.key.toLowerCase();
    if (gPending && GO[k]) { location.href = GO[k]; return; }
    gPending = 0;
    if (k === "g") { gPending = setTimeout(function () { gPending = 0; }, 1200); return; }
    if (k === "n") { e.preventDefault(); window.fableOpen("add"); return; }
    if (e.key === "/") {
      var s = document.querySelector("[data-search]");
      if (s && s.offsetParent !== null) { e.preventDefault(); s.focus(); }
    }
  });

  function setupAddSheet() {
    var sheet = document.querySelector('[data-sheet-id="add"]');
    if (!sheet) return;
    var st = { mode: "EXPENSE", raw: "", cat: "", accIdx: 0, tfToMxn: false };
    var display = document.getElementById("add-amount-display");
    var input = document.getElementById("add-amount-input");
    var saveBtn = document.getElementById("add-save");
    var catsEl = document.getElementById("add-cats");

    function fmtRaw() {
      if (!st.raw) return "$0.00";
      var n = parseFloat(st.raw);
      if (isNaN(n)) return "$0.00";
      var parts = st.raw.split(".");
      var whole = Number(parts[0] || "0").toLocaleString("en-US");
      var dec = parts.length > 1 ? "." + parts[1] : "";
      var sym = ADD_ACCOUNTS[st.accIdx].currency === "MXN" ? "MX$" : "$";
      return sym + whole + dec;
    }

    function fmtSaveAmount() {
      var n = parseFloat(st.raw || "0");
      var sym = ADD_ACCOUNTS[st.accIdx].currency === "MXN" ? "MX$" : "$";
      return sym + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    var COLOR_TILE = {
      green: "bg-brand-green text-brand-green-foreground",
      orange: "bg-brand-orange text-brand-orange-foreground",
      blue: "bg-brand-blue text-brand-blue-foreground",
      purple: "bg-brand-purple text-brand-purple-foreground",
      pink: "bg-brand-pink text-brand-pink-foreground",
      red: "bg-brand-red text-brand-red-foreground",
      yellow: "bg-brand-yellow text-brand-yellow-foreground",
      brown: "bg-brand-gray text-brand-gray-foreground",
      gray: "bg-brand-gray text-brand-gray-foreground",
    };
    function catTileCls(color, selected) {
      if (selected) return "bg-background/15 text-background";
      return COLOR_TILE[color] || COLOR_TILE.gray;
    }

    function renderCats() {
      var list = st.mode === "INCOME" ? INC_CATS : EXP_CATS;
      catsEl.innerHTML = list.map(function (c) {
        var on = st.cat === c.id;
        return (
          '<button type="button" data-add-cat="' + c.id + '" aria-pressed="' + on + '" class="flex h-[74px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 text-[11px] font-medium sm:text-[12px] ' +
          (on ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-accent") + '">' +
          '<span class="grid size-8 place-items-center rounded-lg ' + catTileCls(c.color || "gray", on) + '"><i data-icon="' + c.icon + '" class="size-4"></i></span>' +
          '<span class="max-w-full truncate">' + (c.label || c.id) + "</span></button>"
        );
      }).join("");
      if (window.fableIcons) window.fableIcons(catsEl);
    }

    function renderMoreCats(filter) {
      var q = (filter || "").toLowerCase();
      var el = document.getElementById("add-more-cats-list");
      el.innerHTML = ALL_CATS_GROUPS.map(function (g) {
        var items = g.items.filter(function (i) { return !q || i.id.toLowerCase().indexOf(q) >= 0; });
        if (!items.length) return "";
        return (
          '<div><p class="mb-1.5 text-[12px] font-medium text-muted-foreground">' + g.group + "</p>" +
          '<div class="grid grid-cols-4 gap-2">' +
          items.map(function (c) {
            var on = st.cat === c.id;
            return (
              '<button type="button" data-add-cat="' + c.id + '" class="flex h-[68px] flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-medium sm:text-[12px] ' +
              (on ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-accent") + '">' +
              '<span class="grid size-7 place-items-center rounded-lg ' + catTileCls(c.color || "gray", on) + '"><i data-icon="' + c.icon + '" class="size-3.5"></i></span><span class="max-w-full truncate">' + c.id + "</span></button>"
            );
          }).join("") +
          "</div></div>"
        );
      }).join("");
      if (window.fableIcons) window.fableIcons(el);
    }

    function sync() {
      var hasAmount = parseFloat(st.raw || "0") > 0;
      display.textContent = fmtRaw();
      display.classList.toggle("text-muted-foreground/70", !hasAmount);
      if (document.activeElement !== input) input.value = hasAmount ? fmtRaw() : "";

      var acc = ADD_ACCOUNTS[st.accIdx];
      document.getElementById("add-acc-label").textContent = acc.name;
      document.getElementById("add-currency-note").classList.toggle("hidden", acc.currency !== "MXN" || st.mode === "TRANSFER");
      document.getElementById("add-installments-row").classList.toggle("hidden", !acc.card || st.mode !== "EXPENSE");

      var isTransfer = st.mode === "TRANSFER";
      document.getElementById("add-repeat-wrap").classList.toggle("hidden", st.mode !== "EXPENSE");
      document.getElementById("add-cats").classList.toggle("hidden", isTransfer);
      document.getElementById("add-combo-wrap").classList.toggle("lg:block", !isTransfer);
      document.getElementById("add-transfer-wrap").classList.toggle("hidden", !isTransfer);
      document.getElementById("add-context-wrap").classList.toggle("hidden", isTransfer);
      document.getElementById("add-transfer-disclaimer").classList.toggle("hidden", !isTransfer);
      document.getElementById("add-more-wrap").classList.toggle("hidden", isTransfer);

      if (isTransfer) {
        saveBtn.disabled = !hasAmount;
        saveBtn.textContent = "Save transfer";
      } else if (!hasAmount && !st.cat) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Save";
      } else if (hasAmount && !st.cat) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Pick a category";
      } else if (!hasAmount && st.cat) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Save";
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save " + (st.mode === "INCOME" ? "+" : "") + fmtSaveAmount();
      }
      renderCats();
    }

    document.getElementById("add-mode").addEventListener("fable:change", function (e) {
      st.mode = e.detail;
      st.cat = st.mode === "INCOME" ? "Paycheck" : "";
      document.getElementById("add-more-cats").classList.add("hidden");
      sync();
    });

    sheet.addEventListener("click", function (e) {
      var keyBtn = e.target.closest("[data-key]");
      if (keyBtn) {
        var k = keyBtn.dataset.key;
        if (k === "del") {
          st.raw = st.raw.slice(0, -1);
        } else if (k === ".") {
          if (st.raw.indexOf(".") < 0) st.raw = (st.raw || "0") + ".";
        } else {
          var dec = st.raw.split(".")[1];
          if (dec === undefined || dec.length < 2) st.raw = (st.raw === "0" ? "" : st.raw) + k;
        }
        sync();
        return;
      }
      var rep = e.target.closest("[data-repeat]");
      if (rep) {
        var idx = Number(rep.dataset.repeat);
        if (idx === 0) { st.raw = "6.75"; st.cat = "Dining out"; st.accIdx = 2; document.getElementById("add-payee").value = "Blue Bottle"; }
        if (idx === 1) { st.cat = "Groceries"; st.accIdx = 0; document.getElementById("add-payee").value = "Trader Joe's"; }
        if (idx === 2) { st.raw = "34.00"; st.cat = "Transport"; st.accIdx = 3; document.getElementById("add-payee").value = "MTA OMNY"; }
        sync();
        return;
      }
      var catBtn = e.target.closest("[data-add-cat]");
      if (catBtn) {
        var cid = catBtn.dataset.addCat;
        if (cid === "MORE") {
          var moreBox = document.getElementById("add-more-cats");
          moreBox.classList.toggle("hidden");
          renderMoreCats("");
          return;
        }
        st.cat = cid;
        document.getElementById("add-cat-combo").value = cid;
        sync();
        return;
      }
    });

    input.addEventListener("input", function () {
      st.raw = input.value.replace(/[^0-9.]/g, "");
      sync();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !saveBtn.disabled) { e.preventDefault(); saveBtn.click(); }
    });
    document.getElementById("add-cat-combo").addEventListener("input", function (e) {
      var v = e.target.value.trim();
      if (v) { st.cat = v; sync(); }
    });
    document.getElementById("add-cat-combo").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !saveBtn.disabled) { e.preventDefault(); saveBtn.click(); }
    });
    document.getElementById("add-cat-search").addEventListener("input", function (e) {
      renderMoreCats(e.target.value);
    });

    document.getElementById("add-acc-chip").addEventListener("click", function () {
      st.accIdx = (st.accIdx + 1) % ADD_ACCOUNTS.length;
      sync();
    });

    document.getElementById("add-tf-to").addEventListener("click", function () {
      st.tfToMxn = !st.tfToMxn;
      document.getElementById("add-tf-to-val").textContent = st.tfToMxn ? "BBVA México" : "Joint Checking";
      document.getElementById("add-tf-fx").classList.toggle("hidden", !st.tfToMxn);
    });

    function toggleDetails() {
      document.getElementById("add-details-panel").classList.toggle("hidden");
    }
    document.getElementById("add-more-btn").addEventListener("click", toggleDetails);
    document.getElementById("add-note-chip").addEventListener("click", function () {
      document.getElementById("add-details-panel").classList.remove("hidden");
      document.getElementById("add-note").focus();
    });

    var instSwitch = document.getElementById("add-inst-switch");
    instSwitch.addEventListener("click", function () {
      var on = instSwitch.getAttribute("aria-checked") !== "true";
      instSwitch.setAttribute("aria-checked", String(on));
      var track = instSwitch.querySelector("span:last-child");
      var knob = instSwitch.querySelector("[data-knob]");
      track.classList.toggle("bg-primary", on);
      track.classList.toggle("bg-input", !on);
      knob.classList.toggle("translate-x-5", on);
      document.getElementById("add-inst-options").classList.toggle("hidden", !on);
    });

    saveBtn.addEventListener("click", function () {
      if (saveBtn.disabled) return;
      var msg = st.mode === "TRANSFER"
        ? "Saved · Transfer " + fmtSaveAmount()
        : "Saved · " + st.cat + " " + (st.mode === "INCOME" ? "+" : "−") + fmtSaveAmount();
      window.fableClose();
      window.fableToast(msg, "Add details", function () {
        if (document.querySelector('[data-sheet-id="detail"]')) window.fableOpen("detail");
        else location.href = "transactions.html?sheet=detail";
      });
    });

    sync();
  }

  // ── Inject the shell ───────────────────────────────────────────────────────
  function init() {
    var host = document.querySelector("[data-shell]");
    if (host) {
      var html = "";
      if (host.dataset.tabbar !== "off") html += tabBar(host.dataset.tab || "");
      if (host.dataset.sidebar !== "off") html += sidebar(host.dataset.nav || "");
      html += addSheet();
      html += spaceSheet();
      html += askSheet();
      html += toast();
      host.innerHTML = html;
      if (window.fableIcons) window.fableIcons(host);
      setupAddSheet();
      setupSpaceSheet();
      setupAskSheet();
    }
    // One display rule per sheet present in the page (html[data-sheet="x"] [data-sheet-id="x"]).
    var ids = {};
    document.querySelectorAll("[data-sheet-id]").forEach(function (el) { ids[el.dataset.sheetId] = 1; });
    var css = Object.keys(ids).map(function (id) {
      return 'html[data-sheet="' + id + '"] [data-sheet-id="' + id + '"]{display:block}';
    }).join("");
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    if (root.dataset.sheet && !ids[root.dataset.sheet]) delete root.dataset.sheet;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
