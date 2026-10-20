import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import {
  CONSUMER_PREFIXES,
  autoFetchCustomer,
  evaluateDuplicateStatus,
  formatEntryDuplicateStatus,
  normalizeConsumerNumber,
  suggestCustomers,
  type ConsumerEntryRecord,
  type CustomerRecord,
  type DeliveryManRecord,
  type DuplicateCheckResult,
} from '../utils/deduplication';

interface NewEntryViewProps {
  entries: ConsumerEntryRecord[];
  customers: CustomerRecord[];
  activeDeliveryMen: DeliveryManRecord[];
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
  selectedDeliveryManId: string;
  onSelectDeliveryMan: (id: string) => void;
  todayIST: string;
  currentTimestampIST: string;
  onOpenCustomerRegister?: () => void;
  onSaveEntry: (params: {
    consumerNumber: string;
    customerName?: string;
    deliveryManId: string;
    duplicateToday: boolean;
    duplicate30Days: boolean;
    duplicateMonth: boolean;
  }) => ConsumerEntryRecord;
}

export const NewEntryView: React.FC<NewEntryViewProps> = ({
  entries,
  customers,
  activeDeliveryMen,
  deliveryMenMap,
  usersMap,
  selectedDeliveryManId,
  onSelectDeliveryMan,
  todayIST,
  currentTimestampIST,
  onOpenCustomerRegister,
  onSaveEntry,
}) => {
  const consumerInputRef = useRef<HTMLInputElement | null>(null);
  const deliverySelectRef = useRef<HTMLSelectElement | null>(null);

  const [consumerNumberInput, setConsumerNumberInput] = useState('');
  const [customCustomerNameInput, setCustomCustomerNameInput] = useState('');
  const [isChangingDeliveryMan, setIsChangingDeliveryMan] = useState(!selectedDeliveryManId);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmModalCheck, setConfirmModalCheck] = useState<DuplicateCheckResult | null>(null);
  const [lastSavedEntry, setLastSavedEntry] = useState<ConsumerEntryRecord | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  // Immediately focus Consumer Number when New Entry opens
  useEffect(() => {
    const timer = setTimeout(() => {
      consumerInputRef.current?.focus();
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  const focusConsumerField = () => {
    setTimeout(() => {
      if (consumerInputRef.current) {
        consumerInputRef.current.focus();
      }
    }, 10);
  };

  // Memoized customer map for 0ms instantaneous auto-fetch with 50,000+ records
  const customerMap = useMemo(() => {
    const map = new Map<string, CustomerRecord>();
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      map.set(normalizeConsumerNumber(c.consumer_number), c);
    }
    return map;
  }, [customers]);

  // Real-time normalization, Auto-Fetch Customer, and Duplicate Check as user types
  const normalizedInput = normalizeConsumerNumber(consumerNumberInput);
  const matchedCustomer = autoFetchCustomer(normalizedInput, customers, customerMap);
  const customerSuggestions =
    normalizedInput && !matchedCustomer ? suggestCustomers(normalizedInput, customers, 4) : [];


  const liveDuplicateCheck = evaluateDuplicateStatus(
    normalizedInput,
    entries,
    todayIST,
    deliveryMenMap,
    usersMap
  );

  const selectedDeliveryManName = selectedDeliveryManId
    ? deliveryMenMap[selectedDeliveryManId] || ''
    : '';

  const effectiveCustomerName =
    matchedCustomer?.customer_name || customCustomerNameInput.trim() || '';

  const handleApplyPrefix = (prefix: string) => {
    setConsumerNumberInput((prev) => {
      const stripped = prev.trim().replace(/^(BH-0|CX|DX)/i, '');
      return `${prefix}${stripped}`;
    });
    if (validationError) setValidationError(null);
    focusConsumerField();
  };

  const commitSave = (checkResult: DuplicateCheckResult) => {
    const saved = onSaveEntry({
      consumerNumber: checkResult.normalizedConsumerNumber,
      customerName: effectiveCustomerName,
      deliveryManId: selectedDeliveryManId,
      duplicateToday: checkResult.isDuplicateToday,
      duplicate30Days: checkResult.isDuplicate30Days,
      duplicateMonth: checkResult.isDuplicateMonth,
    });
    setLastSavedEntry(saved);
    setSessionCount((c) => c + 1);
    setConsumerNumberInput('');
    setCustomCustomerNameInput('');
    setConfirmModalCheck(null);
    setValidationError(null);
    setIsChangingDeliveryMan(false);
    // Automatically return cursor focus to Consumer Number field
    focusConsumerField();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!normalizedInput) {
      setValidationError('Please enter a Consumer Number.');
      focusConsumerField();
      return;
    }

    if (!selectedDeliveryManId) {
      setValidationError('Please select a Delivery Man.');
      setIsChangingDeliveryMan(true);
      deliverySelectRef.current?.focus();
      return;
    }

    // If duplicate exists (Today, 30-Day, or This Month), show confirmation dialog before saving
    if (liveDuplicateCheck.hasAnyDuplicate) {
      setConfirmModalCheck(liveDuplicateCheck);
      return;
    }

    commitSave(liveDuplicateCheck);
  };

  const handleSelectDeliveryManAndRefocus = (id: string) => {
    onSelectDeliveryMan(id);
    setValidationError(null);
    if (id) {
      setIsChangingDeliveryMan(false);
      focusConsumerField();
    }
  };

  // Recent entries logged today
  const todayRecentEntries = entries
    .filter((e) => e.entry_date_ist === todayIST)
    .sort((a, b) => b.iso_ist.localeCompare(a.iso_ist))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Primary Column: High-Speed Entry Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
          {/* Header & Live IST Clock */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">New Consumer Entry</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Auto-focused for high-speed entry · Supports <strong>BH-0</strong>, <strong>CX</strong>, <strong>DX</strong> & auto-fetches Customer Register
              </p>
            </div>
            <div className="flex items-center gap-3">
              {onOpenCustomerRegister && (
                <button
                  type="button"
                  onClick={onOpenCustomerRegister}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-950 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="whitespace-nowrap">Upload Excel (Bulk Customers)</span>
                </button>
              )}
              <div className="text-right">
                <div className="text-[11px] font-medium text-slate-500">IST (Asia/Kolkata)</div>
                <div className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{currentTimestampIST}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Last Saved Confirmation Banner */}
          {lastSavedEntry && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs sm:text-sm text-emerald-950">
                  Saved Consumer{' '}
                  <strong className="font-mono font-bold">{lastSavedEntry.consumer_number}</strong>
                  {lastSavedEntry.customer_name ? (
                    <span>
                      {' '}
                      (Customer: <strong>{lastSavedEntry.customer_name}</strong>)
                    </span>
                  ) : null}{' '}
                  for <strong>{deliveryMenMap[lastSavedEntry.delivery_man_id]}</strong> at{' '}
                  <span className="font-mono">{lastSavedEntry.entry_time_ist}</span>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-800 shrink-0">
                Session: {sessionCount}
              </span>
            </div>
          )}

          {validationError && (
            <div
              role="alert"
              className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm font-medium text-red-800"
            >
              {validationError}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="mt-5 space-y-5">
            {/* 1. Consumer Number Input + BH-0, CX, DX Prefix Buttons */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label
                  htmlFor="consumer-number-input"
                  className="text-xs sm:text-sm font-bold text-slate-900"
                >
                  Consumer Number (Starts with BH-0, CX, DX or Numeric)
                </label>

                {/* Quick Prefix Insert Buttons */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-500">Prefix:</span>
                  {CONSUMER_PREFIXES.map((prefix) => {
                    const isPrefixActive = normalizedInput.startsWith(prefix);
                    return (
                      <button
                        key={prefix}
                        type="button"
                        onClick={() => handleApplyPrefix(prefix)}
                        className={`min-h-[34px] px-3 py-1 rounded-lg font-mono font-bold text-xs transition-colors cursor-pointer ${
                          isPrefixActive
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 hover:bg-slate-800 text-amber-400'
                        }`}
                      >
                        {prefix}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <input
                  ref={consumerInputRef}
                  id="consumer-number-input"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  value={consumerNumberInput}
                  onChange={(e) => {
                    setConsumerNumberInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="BH-01001, CX2001, DX3001 or No."
                  className="w-full min-h-[58px] px-4 py-3.5 text-base sm:text-xl font-mono font-bold tracking-wide bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 placeholder:font-normal placeholder:text-sm sm:placeholder:text-base focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
                />
                {consumerNumberInput && (
                  <button
                    type="button"
                    aria-label="Clear Consumer Number"
                    onClick={() => {
                      setConsumerNumberInput('');
                      setCustomCustomerNameInput('');
                      focusConsumerField();
                    }}
                    className="min-h-[44px] min-w-[44px] absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Quick Test Consumer Chips for BH-0, CX, DX & Duplicate Testing */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>Quick test:</span>
                <button
                  type="button"
                  onClick={() => {
                    setConsumerNumberInput('BH-01001');
                    focusConsumerField();
                  }}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-semibold text-[11px] cursor-pointer"
                >
                  BH-01001 (Irfan)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConsumerNumberInput('CX2001');
                    focusConsumerField();
                  }}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-semibold text-[11px] cursor-pointer"
                >
                  CX2001 (Sunita)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConsumerNumberInput('DX3001');
                    focusConsumerField();
                  }}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-semibold text-[11px] cursor-pointer"
                >
                  DX3001 (Anwar)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConsumerNumberInput('0012345678');
                    focusConsumerField();
                  }}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] cursor-pointer"
                >
                  0012345678 (Dup Today)
                </button>
              </div>
            </div>

            {/* AUTO-FETCHED CUSTOMER DETAILS CARD */}
            {normalizedInput && (
              <div aria-live="polite">
                {matchedCustomer ? (
                  <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-300 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs sm:text-sm">
                        <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>AUTO-FETCHED CUSTOMER FROM REGISTER</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-800">
                        {matchedCustomer.consumer_number}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs sm:text-sm text-emerald-950">
                      <div>
                        <div className="text-[11px] text-emerald-700">Customer Name</div>
                        <div className="font-bold text-slate-900">{matchedCustomer.customer_name}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-emerald-700">Mobile</div>
                        <div className="font-mono font-semibold">
                          {matchedCustomer.mobile || 'Not provided'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-emerald-700">Address / Area</div>
                        <div className="font-medium">{matchedCustomer.address || 'Not provided'}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    {customerSuggestions.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-600 mb-1.5">
                          Matching Registered Customers (Tap to Auto-Fill):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {customerSuggestions.map((sug) => (
                            <button
                              key={sug.id}
                              type="button"
                              onClick={() => {
                                setConsumerNumberInput(sug.consumer_number);
                                focusConsumerField();
                              }}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-900 text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <span className="font-mono font-bold text-slate-900">
                                {sug.consumer_number}
                              </span>
                              <span className="text-slate-700 font-medium">{sug.customer_name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label
                        htmlFor="quick-customer-name-input"
                        className="text-xs font-semibold text-slate-600 whitespace-nowrap"
                      >
                        Unregistered Consumer — Customer Name (Optional):
                      </label>
                      <input
                        id="quick-customer-name-input"
                        type="text"
                        value={customCustomerNameInput}
                        onChange={(e) => setCustomCustomerNameInput(e.target.value)}
                        placeholder="Type name to auto-save in Customer Register (or leave blank)"
                        className="flex-1 min-h-[38px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Remembered Delivery Man Banner + Change Delivery Man Button */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Truck className="w-5 h-5 text-slate-700 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Selected Delivery Man (Remembered for Next Entries)
                    </div>
                    <div className="text-base sm:text-lg font-bold text-slate-900">
                      {selectedDeliveryManName || 'None Selected — Choose Below'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsChangingDeliveryMan((prev) => !prev);
                    setTimeout(() => deliverySelectRef.current?.focus(), 20);
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">Change Delivery Man</span>
                </button>
              </div>

              {/* Dropdown + Quick-Tap Delivery Man Buttons */}
              {(isChangingDeliveryMan || !selectedDeliveryManId) && (
                <div className="mt-4 pt-3.5 border-t border-slate-200 space-y-3">
                  <div>
                    <label
                      htmlFor="delivery-man-select"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Select Delivery Man
                    </label>
                    <select
                      ref={deliverySelectRef}
                      id="delivery-man-select"
                      value={selectedDeliveryManId}
                      onChange={(e) => handleSelectDeliveryManAndRefocus(e.target.value)}
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="">-- Select Delivery Man --</option>
                      {activeDeliveryMen.map((dm) => (
                        <option key={dm.id} value={dm.id}>
                          {dm.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick-Tap Buttons for Mobile Speed */}
                  <div className="flex flex-wrap gap-2">
                    {activeDeliveryMen.map((dm) => {
                      const isSelected = dm.id === selectedDeliveryManId;
                      return (
                        <button
                          key={dm.id}
                          type="button"
                          onClick={() => handleSelectDeliveryManAndRefocus(dm.id)}
                          className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {dm.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Live Automatic Duplicate Check Results (Today / 30 Days / This Month) */}
            {normalizedInput && (
              <div className="space-y-3" aria-live="polite">
                {!liveDuplicateCheck.hasAnyDuplicate ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs sm:text-sm font-medium text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Consumer <strong className="font-mono">{normalizedInput}</strong> has no duplicates today,
                      this month, or within the last 30 days.
                    </span>
                  </div>
                ) : (
                  <>
                    {/* 1. DUPLICATE TODAY WARNING */}
                    {liveDuplicateCheck.isDuplicateToday && liveDuplicateCheck.latestTodayMatch && (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-1.5">
                        <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                          <span>⚠️ DUPLICATE TODAY</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-red-950">
                          <div>
                            <div className="text-red-700">Consumer No.</div>
                            <div className="font-mono font-bold">{normalizedInput}</div>
                          </div>
                          <div>
                            <div className="text-red-700">Previous Entry Time</div>
                            <div className="font-mono font-bold">
                              {liveDuplicateCheck.latestTodayMatch.entry.entry_time_ist}
                            </div>
                          </div>
                          <div>
                            <div className="text-red-700">Delivery Man</div>
                            <div className="font-bold">
                              {liveDuplicateCheck.latestTodayMatch.deliveryManName}
                            </div>
                          </div>
                          <div>
                            <div className="text-red-700">Times Entered Today</div>
                            <div className="font-mono font-bold">
                              {liveDuplicateCheck.todayMatches.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. DUPLICATE WITHIN 30 DAYS WARNING */}
                    {liveDuplicateCheck.isDuplicate30Days && liveDuplicateCheck.latest30DaysMatch && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                          <span>⚠️ ENTERED WITHIN LAST 30 DAYS</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-amber-950">
                          <div>
                            <div className="text-amber-700">Consumer No.</div>
                            <div className="font-mono font-bold">{normalizedInput}</div>
                          </div>
                          <div>
                            <div className="text-amber-700">Last Entry Date</div>
                            <div className="font-mono font-bold">
                              {liveDuplicateCheck.latest30DaysMatch.entry.entry_date_ist}
                            </div>
                          </div>
                          <div>
                            <div className="text-amber-700">Previous Time & Delivery Man</div>
                            <div className="font-bold">
                              {liveDuplicateCheck.latest30DaysMatch.entry.entry_time_ist} ·{' '}
                              {liveDuplicateCheck.latest30DaysMatch.deliveryManName}
                            </div>
                          </div>
                          <div>
                            <div className="text-amber-700">Days Since Previous</div>
                            <div className="font-mono font-bold">
                              {liveDuplicateCheck.latest30DaysMatch.daysAgo === 0
                                ? 'Today (0 days ago)'
                                : `${liveDuplicateCheck.latest30DaysMatch.daysAgo} days ago`}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. DUPLICATE THIS MONTH WARNING */}
                    {liveDuplicateCheck.isDuplicateMonth && (
                      <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 space-y-2">
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                          <span>
                            ⚠️ ALREADY ENTERED THIS MONTH ({liveDuplicateCheck.monthMatches.length} matching{' '}
                            {liveDuplicateCheck.monthMatches.length === 1 ? 'entry' : 'entries'})
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-700 font-mono">
                          {liveDuplicateCheck.monthMatches.map((m, idx) => (
                            <div key={m.entry.id} className="flex items-center justify-between">
                              <span>
                                {idx + 1}. {m.entry.entry_date_ist} – {m.entry.entry_time_ist}
                              </span>
                              <span className="font-sans font-semibold text-slate-900">
                                {m.deliveryManName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 4. Large Mobile-Friendly Save Button */}
            <button
              type="submit"
              className="w-full min-h-[56px] px-6 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Save className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Save Entry & Next Consumer</span>
            </button>
          </form>
        </div>

        {/* Right Column: Today's Recent Entries Feed */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 whitespace-nowrap">
              Today’s Live Feed ({todayIST})
            </h2>
            <span className="text-xs font-mono text-slate-500 whitespace-nowrap shrink-0">
              {entries.filter((e) => e.entry_date_ist === todayIST).length} total today
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {todayRecentEntries.map((item) => {
              const statusLabel = formatEntryDuplicateStatus(item);
              const isDup = item.duplicate_today || item.duplicate_30_days || item.duplicate_month;
              const custName =
                item.customer_name || autoFetchCustomer(item.consumer_number, customers)?.customer_name;
              return (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {item.consumer_number}
                      </span>
                      {custName && (
                        <span className="text-xs font-semibold text-slate-700">· {custName}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {deliveryMenMap[item.delivery_man_id] || 'Unknown'} · {item.entry_time_ist}
                    </div>
                  </div>
                  <div
                    className={`text-xs font-semibold whitespace-nowrap ${
                      item.duplicate_today
                        ? 'text-red-600'
                        : isDup
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {statusLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 10: Duplicate Confirmation Dialog (Cancel vs Confirm & Save) */}
      {confirmModalCheck && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-confirm-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="duplicate-confirm-title" className="text-lg font-bold text-slate-900">
                    Duplicate Consumer Detected
                  </h2>
                  <p className="text-xs text-slate-500">
                    Consumer No.{' '}
                    <strong className="font-mono text-slate-900">
                      {confirmModalCheck.normalizedConsumerNumber}
                    </strong>
                    {effectiveCustomerName ? (
                      <span>
                        {' '}
                        · Customer: <strong>{effectiveCustomerName}</strong>
                      </span>
                    ) : null}{' '}
                    · Delivery Man: <strong>{selectedDeliveryManName}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm">
              {confirmModalCheck.isDuplicateToday && confirmModalCheck.latestTodayMatch && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-950">
                  <div className="font-bold text-red-800">⚠️ DUPLICATE TODAY</div>
                  <div className="mt-1">
                    Entered <strong>{confirmModalCheck.todayMatches.length}</strong> time(s) today. Last at{' '}
                    <span className="font-mono font-semibold">
                      {confirmModalCheck.latestTodayMatch.entry.entry_time_ist}
                    </span>{' '}
                    by <strong>{confirmModalCheck.latestTodayMatch.deliveryManName}</strong>.
                  </div>
                </div>
              )}

              {confirmModalCheck.isDuplicate30Days && confirmModalCheck.latest30DaysMatch && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                  <div className="font-bold text-amber-900">⚠️ ENTERED WITHIN LAST 30 DAYS</div>
                  <div className="mt-1">
                    Last Entry:{' '}
                    <span className="font-mono font-semibold">
                      {confirmModalCheck.latest30DaysMatch.entry.entry_date_ist}
                    </span>{' '}
                    ({confirmModalCheck.latest30DaysMatch.entry.entry_time_ist}) · Delivery Man:{' '}
                    <strong>{confirmModalCheck.latest30DaysMatch.deliveryManName}</strong> ·{' '}
                    <strong>
                      {confirmModalCheck.latest30DaysMatch.daysAgo === 0
                        ? 'Today (0 days ago)'
                        : `${confirmModalCheck.latest30DaysMatch.daysAgo} days ago`}
                    </strong>
                  </div>
                </div>
              )}

              {confirmModalCheck.isDuplicateMonth && (
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-900">
                  <div className="font-bold">⚠️ ALREADY ENTERED THIS MONTH</div>
                  <div className="mt-1">
                    Matches {confirmModalCheck.monthMatches.length} existing record(s) in the current calendar month.
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600">
              Do you want to proceed and record this entry with a duplicate flag?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmModalCheck(null);
                  focusConsumerField();
                }}
                className="min-h-[46px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => commitSave(confirmModalCheck)}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
