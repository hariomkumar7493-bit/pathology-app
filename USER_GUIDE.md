# PathLab Pro — User Guide | उपयोगकर्ता गाइड

---

# English

## Table of Contents
1. [Getting Started](#getting-started)
2. [Login](#login)
3. [Dashboard](#dashboard)
4. [Patient Management](#patient-management)
5. [Test Management](#test-management)
6. [Quick Report](#quick-report)
7. [Reports](#reports)
8. [Analyzer Integration](#analyzer-integration)
9. [Report Layout](#report-layout)
10. [Staff Management](#staff-management)
11. [Settings](#settings)
12. [Sync (Electron Only)](#sync-electron-only)
13. [Offline Mode (Electron Only)](#offline-mode-electron-only)
14. [Auto-Update (Electron Only)](#auto-update-electron-only)

---

### Getting Started

PathLab Pro is a pathology laboratory management system. It works as:
- **Web App** — Access from any browser at `https://patholabpro.online`
- **Desktop App (Electron)** — Install on Windows for offline support and analyzer integration
- **Mobile App** — Available for Android

### Login

1. Open the app (web URL or desktop app)
2. Enter your **username** and **password**
3. Click **Login**
4. Default admin credentials are set during first setup
5. If you forget your password, contact your administrator

### Dashboard

The dashboard shows:
- **Total Patients** — All registered patients count
- **Total Reports** — All reports created
- **Total Tests** — All tests configured
- **Pending Reports** — Reports awaiting result entry
- **Recent Reports** — Latest reports with quick view/print options
- **Revenue Overview** — Monthly revenue chart (if enabled)

### Patient Management

**Add a Patient:**
1. Go to **Patients** from the sidebar
2. Click **Add Patient**
3. Fill in patient details:
   - Name (required)
   - Age / Date of Birth
   - Gender
   - Phone number
   - Address
4. Click **Save**

**Search Patients:**
- Use the search bar at the top to find patients by name, phone, or ID

**Edit/Delete:**
- Click on a patient to view details
- Use **Edit** or **Delete** buttons

### Test Management

**Create a Test Category:**
1. Go to **Test Management** from the sidebar
2. Click **Add Category**
3. Enter category name (e.g., "Hematology", "Biochemistry")
4. Click **Save**

**Create a Test:**
1. Click **Add Test**
2. Select a category
3. Enter test name (e.g., "Complete Blood Count")
4. Enter price
5. Add parameters (e.g., Hemoglobin, WBC, RBC)
   - For each parameter: name, unit, reference range (low-high), method
6. Click **Save**

**Edit/Delete:**
- Click on any test to edit or delete it

### Quick Report

Quick Report is the fastest way to create a report:

1. Go to **Quick Report** from the sidebar
2. **Select Patient** — search and select an existing patient, or create a new one
3. **Select Tests** — choose one or more tests from the list
4. The app will automatically load all parameters for the selected tests
5. **Enter Results** — type values for each parameter
   - Reference ranges are shown next to each parameter
   - Abnormal values are highlighted automatically
6. **Enter Referring Doctor** (optional)
7. Click **Save Report**
8. After saving, you can:
   - **Print** — Print directly to a connected printer
   - **PDF** — Download as PDF
   - **Share** — Share via WhatsApp or other apps

### Reports

**View All Reports:**
1. Go to **Reports** from the sidebar
2. All reports are listed with patient name, date, and status
3. Use search and filters to find specific reports

**View a Report:**
- Click on any report to see the full report with all results

**Edit Results:**
1. Open a report
2. Click **Edit**
3. Modify the result values
4. Click **Save**

**Print/Share:**
- **Print** — Print the report directly
- **PDF** — Download as PDF file
- **Share** — Send via WhatsApp, email, or other apps

**Delete a Report:**
- Open the report and click **Delete**

### Analyzer Integration

**Connect a Lab Analyzer for automatic result capture:**

1. Go to **Analyzer** from the sidebar (Desktop app only)
2. Browse analyzers by category (Hematology, Biochemistry, etc.)
3. Select your analyzer model (e.g., Mindray BC-5300, Erba EM 360)
4. Choose connection type:
   - **Serial (RS232)** — Select the COM port
   - **TCP/IP** — Enter the analyzer's IP address and port
5. Click **Connect**
6. When the analyzer completes a test, results will appear automatically in the **Received Results** panel
7. Review the results and assign them to a patient/report

**File Import (for ELISA readers):**
1. Click **Import File**
2. Select the CSV or XML file exported by the analyzer
3. Results will be parsed and displayed

**Supported Analyzers include:**
- Mindray (BC-5300, BC-5380, BC-6800, BS-240, BS-480, CL-2000i)
- Sysmex (XN-1000, XN-550, KX-21, XP-100, CS-5100)
- Erba (H560, H360, EM 360, EM 200, Chem 7, Smart 240)
- Roche (Cobas c111, c311, e411, e601)
- Beckman Coulter (DxH 900, AU480, AU680)
- Siemens (Dimension XPand, RXL Max, Advia Centaur)
- Abbott (Architect c4000, i1000, i2000)
- Horiba (Pentra 60, Yumizen H500, Indiko)
- Transasia (XL 200, XL 640, Chem 7)
- Snibe (Maglumi 800, 2000)
- And many more (50+ analyzers)

### Report Layout

Customize how your printed reports look:

1. Go to **Report Layout** from the sidebar
2. Customize:
   - **Lab Name** and address
   - **Logo** — Upload your lab logo
   - **Header text** and styling
   - **Footer text**
   - **Font size** and colors
   - **Show/Hide** elements (reference ranges, patient photo, etc.)
3. Click **Save Layout**
4. Use **Preview** to see how reports will look

### Staff Management

**Add Staff:**
1. Go to **Staff Management** from the sidebar (admin only)
2. Click **Add Staff**
3. Enter:
   - Name
   - Username
   - Password
   - Role (Admin / Technician / Receptionist)
4. Click **Save**

**Edit/Delete Staff:**
- Click on any staff member to edit or delete

### Settings

1. Go to **Settings** from the sidebar
2. Configure:
   - **Lab information** — Name, address, phone, email
   - **Report preferences** — Default values, formatting
   - **Referring doctors** — Manage doctor list
   - **Theme** — Light/Dark mode
3. Click **Save**

### Sync (Electron Only)

The desktop app works offline and syncs data with the server when online:

1. **Automatic Sync** — Data syncs automatically when internet is available
2. **Manual Sync** — Click the **Sync** button in the sidebar
3. **Sync Status** — Shows pending changes count
4. All patients, reports, tests, and settings sync to the cloud

### Offline Mode (Electron Only)

- The desktop app works completely offline
- All data is stored locally in SQLite database
- When internet is restored, data syncs automatically
- No data loss — all changes are queued and synced

### Auto-Update (Electron Only)

- The desktop app checks for updates automatically
- When an update is available, you'll see a notification
- Click **Update Now** to download and install
- The app will restart after update

---

# हिंदी | Hindi

## विषय सूची
1. [शुरुआत करना](#शुरुआत-करना)
2. [लॉगिन](#लॉगिन)
3. [डैशबोर्ड](#डैशबोर्ड)
4. [मरीज प्रबंधन](#मरीज-प्रबंधन)
5. [टेस्ट प्रबंधन](#टेस्ट-प्रबंधन)
6. [क्विक रिपोर्ट](#क्विक-रिपोर्ट)
7. [रिपोर्ट्स](#रिपोर्ट्स)
8. [एनालाइजर इंटीग्रेशन](#एनालाइजर-इंटीग्रेशन)
9. [रिपोर्ट लेआउट](#रिपोर्ट-लेआउट)
10. [स्टाफ प्रबंधन](#स्टाफ-प्रबंधन)
11. [सेटिंग्स](#सेटिंग्स)
12. [सिंक (डेस्कटॉप ऐप)](#सिंक-डेस्कटॉप-ऐप)
13. [ऑफलाइन मोड (डेस्कटॉप ऐप)](#ऑफलाइन-मोड-डेस्कटॉप-ऐप)
14. [अपडेट (डेस्कटॉप ऐप)](#अपडेट-डेस्कटॉप-ऐप)

---

### शुरुआत करना

PathLab Pro एक पैथोलॉजी लेबोरेटरी मैनेजमेंट सिस्टम है। यह तीन तरह से उपलब्ध है:

- **वेब ऐप** — किसी भी ब्राउज़र से `https://patholabpro.online` पर एक्सेस करें
- **डेस्कटॉप ऐप (Electron)** — विंडोज़ पर इंस्टॉल करें, ऑफलाइन सपोर्ट और एनालाइजर कनेक्शन के लिए
- **मोबाइल ऐप** — एंड्रॉइड के लिए उपलब्ध

### लॉगिन

1. ऐप खोलें (वेब URL या डेस्कटॉप ऐप)
2. अपना **यूज़रनेम** और **पासवर्ड** दर्ज करें
3. **लॉगिन** पर क्लिक करें
4. डिफ़ॉल्ट एडमिन क्रेडेंशियल पहली सेटअप के दौरान सेट किए जाते हैं
5. अगर पासवर्ड भूल जाएं, तो अपने एडमिनिस्ट्रेटर से संपर्क करें

### डैशबोर्ड

डैशबोर्ड पर दिखता है:
- **कुल मरीज** — सभी रजिस्टर्ड मरीजों की संख्या
- **कुल रिपोर्ट्स** — सभी बनाई गई रिपोर्ट्स
- **कुल टेस्ट** — सभी कॉन्फ़िगर्ड टेस्ट
- **पेंडिंग रिपोर्ट्स** — जिन रिपोर्ट्स में रिज़ल्ट दर्ज करना बाकी है
- **हाल की रिपोर्ट्स** — ताज़ा रिपोर्ट्स, क्विक व्यू/प्रिंट के साथ
- **राजस्व ओवरव्यू** — मासिक आय चार्ट (अगर चालू हो)

### मरीज प्रबंधन

**मरीज जोड़ना:**
1. साइडबार से **Patients** पर जाएं
2. **Add Patient** पर क्लिक करें
3. मरीज की जानकारी भरें:
   - नाम (आवश्यक)
   - उम्र / जन्म तिथि
   - लिंग
   - फ़ोन नंबर
   - पता
4. **Save** पर क्लिक करें

**मरीज खोजना:**
- ऊपर सर्च बार में नाम, फ़ोन, या ID लिखकर खोजें

**एडिट/डिलीट:**
- मरीज पर क्लिक करके विवरण देखें
- **Edit** या **Delete** बटन का उपयोग करें

### टेस्ट प्रबंधन

**टेस्ट कैटेगरी बनाना:**
1. साइडबार से **Test Management** पर जाएं
2. **Add Category** पर क्लिक करें
3. कैटेगरी का नाम दर्ज करें (जैसे "हेमेटोलॉजी", "बायोकेमिस्ट्री")
4. **Save** पर क्लिक करें

**टेस्ट बनाना:**
1. **Add Test** पर क्लिक करें
2. कैटेगरी चुनें
3. टेस्ट का नाम दर्ज करें (जैसे "कम्प्लीट ब्लड काउंट")
4. कीमत दर्ज करें
5. पैरामीटर जोड़ें (जैसे हीमोग्लोबिन, WBC, RBC)
   - प्रत्येक पैरामीटर के लिए: नाम, यूनिट, रेफरेंस रेंज (लो-हाई), मेथड
6. **Save** पर क्लिक करें

### क्विक रिपोर्ट

क्विक रिपोर्ट रिपोर्ट बनाने का सबसे तेज़ तरीका है:

1. साइडबार से **Quick Report** पर जाएं
2. **मरीज चुनें** — मौजूदा मरीज खोजें और चुनें, या नया बनाएं
3. **टेस्ट चुनें** — सूची से एक या अधिक टेस्ट चुनें
4. ऐप चुने हुए टेस्ट के सभी पैरामीटर अपने आप लोड कर लेगा
5. **रिज़ल्ट दर्ज करें** — प्रत्येक पैरामीटर के लिए वैल्यू टाइप करें
   - रेफरेंस रेंज हर पैरामीटर के साथ दिखता है
   - असामान्य वैल्यू अपने आप हाईलाइट हो जाती हैं
6. **रेफरिंग डॉक्टर** दर्ज करें (वैकल्पिक)
7. **Save Report** पर क्लिक करें
8. सेव करने के बाद आप कर सकते हैं:
   - **प्रिंट** — कनेक्टेड प्रिंटर पर सीधे प्रिंट करें
   - **PDF** — PDF के रूप में डाउनलोड करें
   - **शेयर** — व्हाट्सएप या अन्य ऐप्स से शेयर करें

### रिपोर्ट्स

**सभी रिपोर्ट्स देखना:**
1. साइडबार से **Reports** पर जाएं
2. सभी रिपोर्ट्स मरीज के नाम, तारीख, और स्टेटस के साथ दिखती हैं
3. खोज और फ़िल्टर का उपयोग करके विशिष्ट रिपोर्ट खोजें

**रिपोर्ट देखना:**
- किसी भी रिपोर्ट पर क्लिक करें, पूरी रिपोर्ट सभी रिज़ल्ट के साथ दिखेगी

**रिज़ल्ट एडिट करना:**
1. रिपोर्ट खोलें
2. **Edit** पर क्लिक करें
3. रिज़ल्ट वैल्यू बदलें
4. **Save** पर क्लिक करें

**प्रिंट/शेयर:**
- **प्रिंट** — रिपोर्ट सीधे प्रिंट करें
- **PDF** — PDF फ़ाइल के रूप में डाउनलोड करें
- **शेयर** — व्हाट्सएप, ईमेल, या अन्य ऐप्स से भेजें

### एनालाइजर इंटीग्रेशन

**लैब एनालाइजर कनेक्ट करके रिज़ल्ट अपने आप प्राप्त करें:**

1. साइडबार से **Analyzer** पर जाएं (केवल डेस्कटॉप ऐप)
2. कैटेगरी अनुसार एनालाइजर ब्राउज़ करें (हेमेटोलॉजी, बायोकेमिस्ट्री, आदि)
3. अपना एनालाइजर मॉडल चुनें (जैसे Mindray BC-5300, Erba EM 360)
4. कनेक्शन टाइप चुनें:
   - **सीरियल (RS232)** — COM पोर्ट चुनें
   - **TCP/IP** — एनालाइजर का IP एड्रेस और पोर्ट दर्ज करें
5. **Connect** पर क्लिक करें
6. जब एनालाइजर टेस्ट पूरा करता है, रिज़ल्ट अपने आप **Received Results** पैनल में दिखेंगे
7. रिज़ल्ट चेक करें और मरीज/रिपोर्ट को असाइन करें

**फ़ाइल इम्पोर्ट (ELISA रीडर के लिए):**
1. **Import File** पर क्लिक करें
2. एनालाइजर से एक्सपोर्ट की गई CSV या XML फ़ाइल चुनें
3. रिज़ल्ट पार्स होकर दिखेंगे

**सपोर्टेड एनालाइजर में शामिल हैं:**
- Mindray (BC-5300, BC-5380, BC-6800, BS-240, BS-480, CL-2000i)
- Sysmex (XN-1000, XN-550, KX-21, XP-100, CS-5100)
- Erba (H560, H360, EM 360, EM 200, Chem 7, Smart 240)
- Roche (Cobas c111, c311, e411, e601)
- Beckman Coulter (DxH 900, AU480, AU680)
- Siemens (Dimension XPand, RXL Max, Advia Centaur)
- Abbott (Architect c4000, i1000, i2000)
- Horiba (Pentra 60, Yumizen H500, Indiko)
- Transasia (XL 200, XL 640, Chem 7)
- Snibe (Maglumi 800, 2000)
- और कई और (50+ एनालाइजर)

### रिपोर्ट लेआउट

अपनी प्रिंटेड रिपोर्ट का लुक कस्टमाइज़ करें:

1. साइडबार से **Report Layout** पर जाएं
2. कस्टमाइज़ करें:
   - **लैब का नाम** और पता
   - **लोगो** — अपना लैब लोगो अपलोड करें
   - **हेडर टेक्स्ट** और स्टाइलिंग
   - **फ़ुटर टेक्स्ट**
   - **फ़ॉन्ट साइज़** और कलर
   - **दिखाएं/छुपाएं** एलिमेंट्स (रेफरेंस रेंज, मरीज फोटो, आदि)
3. **Save Layout** पर क्लिक करें
4. **Preview** से देखें कि रिपोर्ट कैसी दिखेगी

### स्टाफ प्रबंधन

**स्टाफ जोड़ना:**
1. साइडबार से **Staff Management** पर जाएं (केवल एडमिन)
2. **Add Staff** पर क्लिक करें
3. दर्ज करें:
   - नाम
   - यूज़रनेम
   - पासवर्ड
   - रोल (एडमिन / टेक्नीशियन / रिसेप्शनिस्ट)
4. **Save** पर क्लिक करें

### सेटिंग्स

1. साइडबार से **Settings** पर जाएं
2. कॉन्फ़िगर करें:
   - **लैब की जानकारी** — नाम, पता, फ़ोन, ईमेल
   - **रिपोर्ट प्रेफरेंसेज** — डिफ़ॉल्ट वैल्यू, फ़ॉर्मेटिंग
   - **रेफरिंग डॉक्टर्स** — डॉक्टर लिस्ट मैनेज करें
   - **थीम** — लाइट/डार्क मोड
3. **Save** पर क्लिक करें

### सिंक (डेस्कटॉप ऐप)

डेस्कटॉप ऐप ऑफलाइन काम करता है और ऑनलाइन होने पर डेटा सिंक करता है:

1. **ऑटोमैटिक सिंक** — इंटरनेट उपलब्ध होने पर डेटा अपने आप सिंक होता है
2. **मैनुअल सिंक** — साइडबार में **Sync** बटन पर क्लिक करें
3. **सिंक स्टेटस** — पेंडिंग बदलावों की संख्या दिखती है
4. सभी मरीज, रिपोर्ट्स, टेस्ट, और सेटिंग्स क्लाउड पर सिंक होते हैं

### ऑफलाइन मोड (डेस्कटॉप ऐप)

- डेस्कटॉप ऐप पूरी तरह ऑफलाइन काम करता है
- सारा डेटा लोकल SQLite डेटाबेस में सेव होता है
- इंटरनेट वापस आने पर डेटा अपने आप सिंक हो जाता है
- कोई डेटा लॉस नहीं — सभी बदलाव क्यू में रहते हैं और सिंक होते हैं

### अपडेट (डेस्कटॉप ऐप)

- डेस्कटॉप ऐप अपने आप अपडेट चेक करता है
- जब अपडेट उपलब्ध हो, आपको नोटिफिकेशन दिखेगा
- **Update Now** पर क्लिक करके डाउनलोड और इंस्टॉल करें
- अपडेट के बाद ऐप रीस्टार्ट होगा

---

## Support | सहायता

- **Email:** support@patholabpro.online
- **Website:** https://patholabpro.online
- **Phone:** +91-XXXXXXXXXX

---

*PathLab Pro — Pathology Laboratory Management System*
*PathLab Pro — पैथोलॉजी लेबोरेटरी मैनेजमेंट सिस्टम*
