# RS.ge Electronic Waybill Service — API Reference

> Source: `waybill_protocol.pdf` — Official RS.ge WaybillService documentation, version 4.0.4 (2012–2023)
> SOAP endpoint: `https://services.rs.ge/WayBillService/WaybillService.asmx`

---

## 1. Waybill Types (`TYPE` field)

| ID | Georgian | Description |
|----|----------|-------------|
| 1 | შიდა გადაზიდვა | Internal transport |
| 2 | მიწოდება ტრანსპორტირებით | Delivery with transportation |
| 3 | მიწოდება ტრანსპორტირების გარეშე | Delivery without transportation |
| 4 | დისტრიბუცია | Distribution (parent waybill for sub-waybills) |
| 5 | საქონლის უკან დაბრუნება | Return of goods |
| 6 | ქვე-ზედნადები | Sub-waybill (child of TYPE=4; requires `PAR_ID`) |

> **Note**: TYPE 4 (Distribution) may have multiple TYPE 6 (Sub-waybill) children linked via `PAR_ID`.
> Our live data (215 buyer waybills, May 2026) shows: TYPE 1 (10), TYPE 2 (185), TYPE 3 (15), TYPE 5 (5). No TYPE 4 or 6 in buyer view.

---

## 2. Waybill Statuses (`STATUS` field)

| Code | Georgian | Description |
|------|----------|-------------|
| 0 | შენახული | Saved (draft, not yet activated) |
| 1 | აქტიური | Active (activated / in transit) |
| 2 | დასრულებული | Completed (closed) |
| 8 | გადამზიდავთან გადაგზავნილი | Forwarded to carrier/transporter |
| -1 | წაშლილი | Deleted |
| -2 | გაუქმებული | Cancelled |

---

## 3. Confirmation Status (`IS_CONFIRMED` field in buyer view)

| Code | Georgian | Description |
|------|----------|-------------|
| 0 | დაუდასტურებელი | Not confirmed |
| 1 | დადასტურებული | Confirmed (buyer accepted) |
| -1 | უარყოფილი | Rejected (buyer disagreed) |

> Applies only to buyer-side methods (`get_buyer_waybills_ex`). Only relevant for seller–buyer relationships, not carrier flows.

---

## 4. Buyer Status (`BUYER_ST` / `SELLER_ST` field)

| Code | Georgian | Description |
|------|----------|-------------|
| 0 | — | No special status |
| 1 | მიკრო | Micro business |
| 2 | მცირე | Small business |

> Stored as raw code in `rs_waybills_in_api.seller_st`. Use `rsSellerStLabel()` from `constants.ts` to get the Georgian label.

---

## 5. Customs Status (`CUST_STATUS` field)

| Code | Description |
|------|-------------|
| 1 | Confirmed by customs |
| 2 | Rejected by customs |

> Only relevant for timber (ხე-ტყე) export waybills.

---

## 6. Transport Cost Payer (`TRAN_COST_PAYER` field)

| Code | Georgian | Description |
|------|----------|-------------|
| 1 | მყიდველი | Buyer pays transport cost |
| 2 | გამყიდველი | Seller pays transport cost |

> Stored as resolved label in `rs_waybills_in_items.tran_cost_payer`. Use `rsTranCostPayerLabel()` from `constants.ts`.

---

## 7. VAT Type (`VAT_TYPE` on goods items)

| Code | Georgian | Description |
|------|----------|-------------|
| 0 | ჩვეულებრივი | Standard (VAT applies) |
| 1 | ნულოვანი | Zero-rated |
| 2 | დაუბეგრავი | Exempt (non-taxable) |

---

## 8. Category Field (`CATEGORY`)

| Value | Meaning |
|-------|---------|
| 0 / empty | Regular goods |
| 1 | Timber (ხე-ტყე) |

---

## 9. Unit IDs (`UNIT_ID` field)

Official list from `get_waybill_units()` — 14 units exist (IDs 6, 15–18 do NOT exist):

| ID | Georgian | Description |
|----|----------|-------------|
| 1 | ც (ცალი) | Piece |
| 2 | კგ | Kilogram |
| 3 | გ (გრამი) | Gram |
| 4 | ლ (ლიტრი) | Litre |
| 5 | ტ (ტონა) | Tonne |
| 7 | სმ (სანტიმეტრი) | Centimetre |
| 8 | მ (მეტრი) | Metre |
| 9 | კმ (კილომეტრი) | Kilometre |
| 10 | კვ.სმ | Square centimetre |
| 11 | კვ.მ | Square metre |
| 12 | მ³ | Cubic metre |
| 13 | მლ (მილილიტრი) | Millilitre |
| 14 | შეკვ (შეკვრა) | Bundle/Package |
| 99 | სხვა | Custom — `UNIT_TXT` holds actual name |

> When `UNIT_ID=99`, the `UNIT_TXT` field contains the actual unit name.
> The bulk goods method `get_buyer_waybilll_goods_list` does **not** return `UNIT_TXT` — only `UNIT_ID`.

---

## 10. SOAP Methods Reference

### Authentication

All methods require `su` (service username) and `sp` (service password).

**Test credentials (from protocol)**:
- User 1: `tbilisi` / `123456`, TIN: `206322102`
- User 2: `satesto2` / `123456`, TIN: `12345678910`

---

### 10.1 Admin / User Management

#### `update_service_user`
```
public bool update_service_user(string user_name, string user_password, string ip,
                                 string name, string su, string sp)
```
Updates a service user record. Returns `true` on success.

#### `get_service_users`
```
public XmlNode get_service_users(string user_name, string user_password)
```
Returns list of service users. Response: `<ServiceUsers>` with `<ID>`, `<USER_NAME>`, `<UN_ID>`, `<IP>`, `<NAME>`.

#### `chek_service_user`
```
public bool chek_service_user(string su, string sp, out int un_id, out int s_user_id)
```
Validates credentials. Returns `un_id` (taxpayer unique number) and `s_user_id`.

---

### 10.2 Reference Data

#### `get_akciz_codes`
```
public XmlNode get_akciz_codes(string su, string sp)
```
Returns excise goods codes. Response: `<AKCIZ_CODES>` with `<ID>`, `<TITLE>`, `<MEASUREMENT>`, `<SAKON_KODI>`, `<AKCIS_GANAKV>`.

#### `get_waybill_types`
```
public XmlNode get_waybill_types(string su, string sp)
```
Returns waybill types. Response: `<WAYBILL_TYPES>` with `<WAYBILL_TYPE>` containing `<ID>` and `<NAME>`.
> Protocol example shows `<ID>6</ID><NAME>ქვე-ზედნადები</NAME>`. Full list from protocol text: IDs 1–6 (see section 1 above).

#### `get_waybill_units`
```
public XmlNode get_waybill_units(string su, string sp)
```
Returns measurement units. Response: `<WAYBILL_UNITS>` with `<WAYBILL_UNIT>` containing `<ID>` and `<NAME>`.

#### `get_trans_types`
```
public XmlNode get_trans_types(string su, string sp)
```
Returns transportation vehicle types. Response: `<TRANSPORT_TYPES>` with `<TRANSPORT_TYPE>` containing `<ID>` and `<NAME>`. When `TRANS_ID=4`, `TRANS_TXT` holds custom vehicle type.

#### `get_wood_types`
```
public XmlNode get_wood_types(string su, string sp)
```
Returns timber product types. Response: `<WOOD_TYPES>` with `<ID>`, `<NAME>`, `<DESCRIPTION>`.

---

### 10.3 Core Waybill Operations

#### `save_waybill` (Create/Update)
```
public XmlNode save_waybill(string su, string sp, XmlNode waybill)
```

**Request XML key fields**:

| Field | Description |
|-------|-------------|
| `ID` | Waybill ID; pass `0` for new |
| `TYPE` | Waybill type (1–6, see section 1) |
| `BUYER_TIN` | Buyer's personal/ID number |
| `CHEK_BUYER_TIN` | `0`=foreign, `1`=Georgian citizen |
| `BUYER_NAME` | Buyer's name |
| `START_ADDRESS` | Transport start address |
| `END_ADDRESS` | Transport end address |
| `DRIVER_TIN` | Driver's personal number |
| `CHEK_DRIVER_TIN` | `0`=foreign, `1`=Georgian citizen |
| `DRIVER_NAME` | Driver's name |
| `TRANSPORT_COAST` | Transport cost amount |
| `TRAN_COST_PAYER` | `1`=buyer pays, `2`=seller pays |
| `TRANS_ID` | Transport type ID |
| `TRANS_TXT` | Transport type label (when `TRANS_ID=4` "Other") |
| `STATUS` | `0`=saved, `1`=activated, `2`=completed |
| `SELER_UN_ID` | Seller's unique number (from `chek_service_user`) |
| `PAR_ID` | Parent waybill ID — **required when TYPE=6** |
| `CAR_NUMBER` | Vehicle registration number |
| `BEGIN_DATE` | Transport start datetime |
| `DELIVERY_DATE` | Delivery date (fill before closing) |
| `FULL_AMOUNT` | Total amount |
| `WAYBILL_NUMBER` | Waybill number (assigned by system on activation) |
| `COMMENT` | Comment/notes |
| `CATEGORY` | `0`/empty=normal, `1`=timber |
| `IS_MED` | `0`/empty=normal, `1`=pharmaceutical |
| `TRANSPORTER_TIN` | Carrier company ID (when using carrier flow) |

**Goods list** (`<GOODS_LIST><GOODS>`):

| Field | Required | Description |
|-------|----------|-------------|
| `ID` | Yes | Goods record ID; `0` for new |
| `W_NAME` | Yes | Goods name |
| `UNIT_ID` | Yes | Unit ID |
| `UNIT_TXT` | When UNIT_ID=99 | Custom unit name |
| `QUANTITY` | Yes | Quantity |
| `PRICE` | Yes | Price |
| `AMOUNT` | Yes | Total amount |
| `BAR_CODE` | Yes | Barcode (or pharma registration number) |
| `STATUS` | — | `1`=active, `-1`=delete this item |
| `A_ID` | — | Excise ID (`0` if not excisable) |
| `VAT_TYPE` | — | `0`=standard, `1`=zero, `2`=exempt |
| `QUANTITY_EXT` | — | Auxiliary quantity |
| `W_ID` | — | Timber type ID |
| `WOOD_LABEL` | — | Timber tag number |

**Response**:
```xml
<RESULT>
  <STATUS>0</STATUS>   <!-- 0=saved, negative=error code -->
  <ID>1551</ID>        <!-- waybill ID -->
  <GOODS_LIST>
    <GOODS>
      <ERROR>-1</ERROR>  <!-- per-item errors -->
      <ID>0</ID>
      ...
    </GOODS>
  </GOODS_LIST>
</RESULT>
```
> Error codes via `get_error_codes()`. If `STATUS < 0`, nothing is saved.

---

#### `get_waybill` (Single waybill detail)
```
public XmlNode get_waybill(string su, string sp, int waybill_id)
```
Returns full waybill XML including `<GOODS_LIST>` and `<SUB_WAYBILLS>`.

**Key response fields** (in addition to save_waybill fields):
- `CREATE_DATE` — creation datetime
- `ACTIVATE_DATE` — activation datetime
- `CLOSE_DATE` — completion datetime
- `CUST_STATUS` — customs status (1=approved, 2=rejected)
- `CUST_NAME` — customs checkpoint name
- Sub-waybills: `<SUB_WAYBILLS><SUB_WAYBILL><ID>` / `<WAYBILL_NUMBER>`

> **Tip**: This is the only method that returns `UNIT_TXT` for UNIT_ID=99 items. Use `getWaybill(su, sp, waybillId)` per-waybill for full goods detail.

---

### 10.4 Waybill List Methods

#### `get_waybills` (Seller side)
```
public XmlNode get_waybills(string su, string sp, string itypes, string buyer_tin,
  string statuses, string car_number,
  DateTime begin_date_s, DateTime begin_date_e,
  DateTime create_date_s, DateTime create_date_e,
  string driver_tin,
  DateTime delivery_date_s, DateTime delivery_date_e,
  decimal full_amount, string waybill_number,
  DateTime close_date_s, DateTime close_date_e,
  string s_user_ids, string comment)
```
Returns waybills issued **by** the authenticated user (seller view).

#### `get_waybills_ex` (Seller side — extended)
Same as `get_waybills` plus:
- `is_confirmed` — `0`=not confirmed, `1`=confirmed, `-1`=rejected

#### `get_buyer_waybills` (Buyer side)
```
public XmlNode get_buyer_waybills(string su, string sp, string itypes, string seller_tin,
  string statuses, ...)
```
Returns waybills **received by** the authenticated user (buyer view). Same parameters as `get_waybills` but `seller_tin` instead of `buyer_tin`.

> **Important**: Use `create_date_s/create_date_e` (creation date) for filtering, NOT `begin_date_s/e`. The `begin_date_s/e` filter returns `-1064` when no waybills have a BEGIN_DATE in range.

#### `get_buyer_waybills_ex` (Buyer side — extended)
Same as `get_buyer_waybills` plus `is_confirmed` filter.

#### `get_waybills_v1` (By last update date — both sides)
```
public XmlNode get_waybills_v1(string su, string sp, string? buyer_tin,
  DateTime last_update_date_s, DateTime last_update_date_e)
```
Returns both issued and received waybills updated in the given window.
- Max date range: **3 days**
- Returns both buyer and seller sides for the authenticated user

---

**Response fields for all list methods**:

| Field | Description |
|-------|-------------|
| `ID` | Waybill internal ID |
| `TYPE` | Waybill type code |
| `CREATE_DATE` | Creation date |
| `BUYER_NAME` / `SELLER_NAME` | Party name |
| `BUYER_TIN` / `SELLER_TIN` | Party TIN |
| `START_ADDRESS` | Transport start address |
| `END_ADDRESS` | Transport end address |
| `DRIVER_TIN` | Driver TIN |
| `TRANSPORT_COAST` | Transport cost |
| `DELIVERY_DATE` | Delivery date |
| `STATUS` | Waybill status code |
| `ACTIVATE_DATE` | Activation date |
| `PAR_ID` | Parent waybill ID (for sub-waybills) |
| `FULL_AMOUNT` | Total amount |
| `CAR_NUMBER` | Vehicle number |
| `WAYBILL_NUMBER` | Waybill number (assigned at activation) |
| `CLOSE_DATE` | Completion date |
| `BEGIN_DATE` | Transport start date |
| `WAYBILL_COMMENT` | Comment |
| `BUYER_ST` / `SELLER_ST` | Business status (0=none, 1=micro, 2=small) |
| `IS_CONFIRMED` | Buyer confirmation (-1=rejected, 0=pending, 1=confirmed) |

---

### 10.5 Waybill Lifecycle Operations

#### Activation

**`send_waybill`** — Activate immediately:
```
public string send_waybill(string su, string sp, int waybill_id)
```
Returns: waybill number string.

**`send_waybill_vd`** — Activate with specific start date:
```
public string send_waybill_vd(string su, string sp, DateTime begin_date, int waybill_id)
```

#### Completion (Closing)

**`close_waybill`**:
```
public int close_waybill(string su, string sp, int waybill_id)
```
Returns: `1`=closed, `-1`=failed, `-101`=not owner, `-100`=invalid credentials.

**`close_waybill_vd`** — Close with specific delivery date:
```
public int close_waybill_vd(string su, string sp, DateTime delivery_date, int waybill_id)
```

#### Deletion / Cancellation

**`del_waybill`** (Delete saved waybill):
```
public int del_waybill(string su, string sp, int waybill_id)
```
Returns: `1`=done, `-1`=failed, `-101`=not owner, `-100`=invalid credentials.

**`ref_waybill`** (Cancel activated waybill):
```
public int ref_waybill(string su, string sp, int waybill_id)
```
Returns: `1`=done, `-1`=failed, `-101`=not owner, `-100`=invalid credentials.

#### Buyer Confirmation

**`confirm_waybill`**:
```
public bool confirm_waybill(string su, string sp, int waybill_id)
```
Buyer confirms receipt. Returns `true` if confirmed.

**`reject_waybill`**:
```
public bool reject_waybill(string su, string sp, int waybill_id)
```
Buyer rejects waybill.

---

### 10.6 Carrier (Transporter) Flow

Used when a seller delegates transportation to a carrier company (`TRANSPORTER_TIN` in `save_waybill`).

#### `save_waybill_transporter`
```
public int save_waybill_transporter(string su, string sp, int waybill_id,
  string car_number, string driver_tin, int chek_driver_tin, string driver_name,
  int trans_id, string trans_txt, string reception_info, string receiver_info)
```
Carrier fills in their transport fields.

#### `send_waybill_transporter`
```
public int send_waybill_transporter(string su, string sp, int waybill_id,
  DateTime begin_date, out string waybill_number)
```
Carrier activates the waybill.

#### `close_waybill_transporter`
```
public int close_waybill_transporter(string su, string sp, int waybill_id,
  string reception_info, string receiver_info, DateTime delivery_date)
```
Carrier closes waybill after delivery.

---

### 10.7 Invoice Generation

#### `save_invoice`
```
public int save_invoice(string su, string sp, int waybill_id, int in_inv_id, out int out_inv_id)
```
Generates a tax invoice from a waybill.
Returns: `out_inv_id`=invoice number, `1`=created, `-1`=failed, `-101`=not owner, `-100`=invalid credentials.

---

### 10.8 Templates (Portal use only)

- `save_waybill_tamplate(su, sp, v_name, waybill_xml)` — save template
- `get_waybill_tamplates(su, sp)` — list templates
- `get_waybill_tamplate(su, sp, id)` — get template XML
- `delete_waybill_tamplate(su, sp, id)` — delete template

---

### 10.9 Barcode Registry (Portal use only)

- `save_bar_code(su, sp, bar_code, goods_name, unit_id, unit_txt, a_id)` — save barcode
- `delete_bar_code(su, sp, bar_code)` — delete barcode
- `get_bar_codes(su, sp, bar_code)` — list barcodes

---

### 10.10 Distribution Vehicle Registry

- `save_car_numbers(su, sp, car_number)` — register vehicle
- `delete_car_numbers(su, sp, car_number)` — remove vehicle
- `get_car_numbers(su, sp)` — list vehicles

---

## 11. Timber (ხე-ტყე) Waybills

Mandatory for: round timber (logs), primary processed products, trees, debarked round timber under 1 metre.

Additional required fields:
- `CATEGORY=1`
- `WOOD_DOCS_LIST` — list of origin documents:
  - `DOC_N` — document number
  - `DOC_DATE` — issue date
  - `DOC_DESC` — document name (e.g., "ლიცენზია")
- `WOOD_LABELS` — tag numbers
- `W_ID` — timber type ID (from `get_wood_types()`)

Customs confirmation (`CUST_STATUS`) is applied by border checkpoints during export; after confirmation no edits are possible.

---

## 12. Distribution Waybill Flow (TYPE=4 + TYPE=6)

1. Seller creates a **main distribution waybill** (`TYPE=4`) without a specific buyer (`BUYER_TIN` may be empty).
2. For each delivery destination, seller creates a **sub-waybill** (`TYPE=6`) with:
   - `PAR_ID` = ID of the parent TYPE=4 waybill
   - Specific `BUYER_TIN` and goods
3. Sub-waybills appear in `<SUB_WAYBILLS>` block when calling `get_waybill` on the parent.

---

## 13. `get_buyer_waybilll_goods_list` (Undocumented Bulk Method)

Not in the official protocol. Used by our system for efficient bulk goods retrieval.

- Returns goods for a list of waybills without calling `get_waybill` per waybill
- **Does NOT return** `UNIT_TXT` — only `UNIT_ID`
- For items with `UNIT_ID=99`, must call `get_waybill(rs_id)` individually to get `UNIT_TXT`
- See `getBuyerWaybillGoodsList()` in `lib/integrations/rsge/client.ts`

---

## 14. Our Implementation — `constants.ts` Mapping

File: `lib/integrations/rsge/constants.ts`

### `RS_WAYBILL_TYPE` (confirmed by cross-reference + protocol)

```typescript
export const RS_WAYBILL_TYPE: Record<string, string> = {
  '1': 'შიდა გადაზიდვა',
  '2': 'ტრანსპორტირებით',
  '3': 'ტრანსპორტირების გარეშე',
  '4': 'დისტრიბუცია',
  '5': 'უკან დაბრუნება',
  '6': 'ქვე-ზედნადები',
};
```

> **Historical bug**: The original mapping had types 1, 3, 4, 5 wrong. A 3-way label swap + TYPE 4 rename was applied to `rs_waybills_in_api.type` in May 2026 to fix existing DB records.

### `RS_WAYBILL_STATUS`

```typescript
export const RS_WAYBILL_STATUS: Record<string, string> = {
  '0':  'შენახული',
  '1':  'აქტიური',
  '2':  'დასრულებული',
  '8':  'გადამზიდავთან გადაგზავნილი',
  '-1': 'წაშლილი',
  '-2': 'გაუქმებული',
};
```

### `RS_WAYBILL_CONDITION` (from `IS_CONFIRMED`)

```typescript
export const RS_WAYBILL_CONDITION: Record<string, string> = {
  '0':  'მისაღები',   // portal label for pending
  '1':  'მიღებული',  // portal label for confirmed
  '-1': 'უარყოფილი', // buyer rejected
};
```

> Default (null/missing IS_CONFIRMED) → `'მისაღები'`. Resolved via `rsWaybillConditionLabel()`.

### `RS_TRAN_COST_PAYER`

```typescript
export const RS_TRAN_COST_PAYER: Record<string, string> = {
  '1': 'მყიდველი',
  '2': 'გამყიდველი',
};
```

> Applied in `backfill-items` route; stored as label in `rs_waybills_in_items.tran_cost_payer`.

### `RS_SELLER_ST`

```typescript
export const RS_SELLER_ST: Record<string, string> = {
  '0': '',
  '1': 'მიკრო',
  '2': 'მცირე',
};
```

> `rs_waybills_in_api.seller_st` stores the raw code; use `rsSellerStLabel()` for display.

---

## 15. Our Sync Implementation Notes

- **Sync endpoint**: `lib/waybills/run-waybill-sync.ts` → `runWaybillSync()`
- **Items sync**: `lib/waybills/run-waybill-items-sync.ts` → `runWaybillItemsSync()`
- **Cron jobs**: `waybills-today` (hourly 08–20 Tbilisi, `0 4-16 * * *` UTC), `waybills-quarterly` (04:00 Tbilisi daily, `0 0 * * *` UTC)
- **Execution order**: waybills first → items second (so waybill records exist before items are inserted)
- **Filter used**: `create_date_s / create_date_e` — matches portal's "Activation Period"
- **Multi-insider**: `RS_CREDENTIALS_MAP` in Vercel env; one object per insider/company
- **VAT lock**: `vat` field captured at first import, never overwritten on update
- **Table**: `rs_waybills_in_api` — single source of truth; user fields (project, financial code, account) start NULL
- **Items table**: `rs_waybills_in_items` — user-assigned fields (`project_uuid`, `financial_code_uuid`, `corresponding_account`) are preserved; waybills that already have items are skipped on subsequent syncs
- **Items batching**: same-calendar-month range = one API call; multi-month range (quarterly) = one call per calendar month via `get_buyer_waybilll_goods_list`
