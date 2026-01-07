/**
 * TRIVANTAS Business Tools App Logic
 * Enhanced with JWT auth, Cloudinary PDF upload, and bill editing
 */

const API_URL = 'https://trivantas.onrender.com';

// Get bill type from current page URL
function getBillType() {
    const path = window.location.pathname;
    if (path.includes('quotation')) return 'quotation';
    if (path.includes('purchase-order')) return 'purchase-order';
    if (path.includes('proforma-invoice')) return 'proforma-invoice';
    if (path.includes('tax-invoice')) return 'tax-invoice';
    return 'tax-invoice'; // default
}

// Get auth token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Get edit bill ID from URL
function getEditBillId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('edit');
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    injectToolbar();
    setupCalculations();
    setupDeleteColumns();

    // Check if editing existing bill
    const editId = getEditBillId();
    if (editId) {
        await loadBillForEdit(editId);
    } else {
        // Disable editing on initial load (dashed lines hidden via CSS pointer-events, but this cleans attribute state)
        document.querySelectorAll('[contenteditable]').forEach(el => el.contentEditable = false);
    }
}

/**
 * Load existing bill for editing
 */
async function loadBillForEdit(billId) {
    try {
        const response = await fetch(`${API_URL}/api/bill/${billId}`);
        if (!response.ok) throw new Error('Bill not found');

        const bill = await response.json();

        // Restore the content
        const contentWrapper = document.querySelector('.content-wrapper');
        if (contentWrapper && bill.content && bill.content.html) {
            contentWrapper.innerHTML = bill.content.html;

            // Re-setup delete columns for loaded content
            setupDeleteColumns();

            // Store bill ID for update
            window.currentBillId = billId;

            // Show edit mode indicator
            const editBadge = document.getElementById('editBadge');
            if (editBadge) {
                editBadge.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error loading bill for edit:', error);
        alert('Failed to load bill for editing');
    }
}

/**
 * Injects the floating toolbar into the page
 */
function injectToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'app-toolbar';
    toolbar.innerHTML = `
        <div class="toolbar-inner">
            <div class="toolbar-left">
                <a href="index.html" class="tb-btn tb-icon" title="Home">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9,22 9,12 15,12 15,22"/>
                    </svg>
                </a>
                <a href="dashboard.html" class="tb-btn tb-icon" title="Dashboard">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                </a>
                <div class="tb-divider"></div>
                <span class="edit-badge" id="editBadge" style="display:none;">
                    ✏️ Editing
                </span>
            </div>
            <div class="toolbar-center">
                <button class="tb-btn tb-primary" id="btn-edit" onclick="toggleEditMode()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <span class="btn-text">Edit</span>
                </button>
                <button class="tb-btn" onclick="addNewRow()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span class="btn-text">Add Row</span>
                </button>
            </div>
            <div class="toolbar-right">
                <button class="tb-btn tb-success" id="btn-save" onclick="saveBill()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17,21 17,13 7,13 7,21"/>
                        <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    <span class="btn-text">Save</span>
                </button>
                <button class="tb-btn" onclick="printDocument()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 6,2 18,2 18,9"/>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    <span class="btn-text">Print</span>
                </button>
                <button class="tb-btn tb-accent" onclick="downloadPDF()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span class="btn-text">PDF</span>
                </button>
            </div>
        </div>
        <style>
            #app-toolbar {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                background: #ffffff;
                padding: 12px 20px;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(26, 37, 48, 0.15), 0 2px 8px rgba(0,0,0,0.08);
                z-index: 1000;
                border: 1px solid #e3e8ec;
            }
            
            .toolbar-inner {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .toolbar-left,
            .toolbar-center,
            .toolbar-right {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .tb-divider {
                width: 1px;
                height: 24px;
                background: #e3e8ec;
                margin: 0 4px;
            }
            
            .edit-badge {
                background: #fff3cd;
                color: #856404;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .tb-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 14px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
                font-weight: 500;
                font-size: 0.85rem;
                background: #f4f7f6;
                color: #2c3e50;
                transition: all 0.2s ease;
                text-decoration: none;
            }
            
            .tb-btn:hover {
                background: #e3e8ec;
                transform: translateY(-1px);
            }
            
            .tb-btn svg {
                flex-shrink: 0;
            }
            
            .tb-icon {
                padding: 10px;
            }
            
            .tb-primary {
                background: #3498db;
                color: white;
            }
            
            .tb-primary:hover {
                background: #2980b9;
            }
            
            .tb-success {
                background: #76c043;
                color: white;
            }
            
            .tb-success:hover {
                background: #5fa032;
            }
            
            .tb-accent {
                background: #1a2530;
                color: white;
            }
            
            .tb-accent:hover {
                background: #2c3e50;
            }
            
            .tb-danger {
                background: #e74c3c;
                color: white;
            }
            
            /* Editable Styles */
            [contenteditable="true"] {
                border-bottom: 2px dashed #3498db;
                outline: none;
                background: rgba(52, 152, 219, 0.05);
                min-width: 20px;
                transition: all 0.2s;
            }
            
            [contenteditable="true"]:focus {
                background: rgba(52, 152, 219, 0.1);
                border-bottom-style: solid;
            }
            
            /* Delete Column Styles */
            .delete-col {
                display: none;
                width: 40px;
                text-align: center;
            }
            
            .delete-btn {
                background: #e74c3c;
                color: white;
                border: none;
                width: 26px;
                height: 26px;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: all 0.2s;
            }
            
            .delete-btn:hover {
                background: #c0392b;
                transform: scale(1.1);
            }
            
            body.edit-mode .delete-col {
                display: table-cell;
            }
            
            body.edit-mode #btn-edit {
                background: #e74c3c;
            }
            
            body.edit-mode #btn-edit:hover {
                background: #c0392b;
            }

            /* Responsive Toolbar */
            @media (max-width: 768px) {
                #app-toolbar {
                    left: 16px;
                    right: 16px;
                    bottom: 16px;
                    transform: none;
                    padding: 10px 12px;
                }
                
                .toolbar-inner {
                    justify-content: space-between;
                    gap: 8px;
                }
                
                .btn-text {
                    display: none;
                }
                
                .tb-btn {
                    padding: 10px;
                }
                
                .tb-divider {
                    display: none;
                }
                
                .edit-badge {
                    font-size: 0.7rem;
                    padding: 3px 8px;
                }
            }
            
            @media (max-width: 480px) {
                .toolbar-center {
                    display: none;
                }
                
                #app-toolbar {
                    border-radius: 12px;
                }
            }

            @media print {
                #app-toolbar { display: none !important; }
                [contenteditable="true"] { border: none !important; background: none !important; }
                .delete-col { display: none !important; }
            }
        </style>
    `;
    document.body.appendChild(toolbar);
}

/**
 * Toggles contenteditable on relevant elements
 */
let isEditMode = false;
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('btn-edit');
    // Using [contenteditable] and specific others. Removing generic td/p to prevent double-border and Sr No editing.
    const editableElements = document.querySelectorAll('[contenteditable], .editable, h1, .meta-value, .bank-info p, .terms-list li, .total-row span');

    editableElements.forEach(el => {
        el.contentEditable = isEditMode;
    });

    if (isEditMode) {
        document.body.classList.add('edit-mode');
        if (btn) {
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"/>
                </svg>
                <span class="btn-text">Done</span>
            `;
        }
    } else {
        document.body.classList.remove('edit-mode');
        if (btn) {
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span class="btn-text">Edit</span>
            `;
        }
    }
}

/**
 * Setup Delete Columns for existing table
 */
function setupDeleteColumns() {
    const table = document.querySelector('.item-table');
    if (!table) return;

    // Check if already setup
    if (table.querySelector('.delete-col')) return;

    // Add Header
    const theadRow = table.querySelector('thead tr');
    if (theadRow) {
        const th = document.createElement('th');
        th.className = 'delete-col';
        th.innerHTML = '';
        theadRow.appendChild(th);
    }

    // Add Body Cells
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 2) {
            addDeleteCell(row);
        } else {
            const spacerCell = row.querySelector('td[colspan]');
            if (spacerCell) {
                spacerCell.setAttribute('colspan', parseInt(spacerCell.getAttribute('colspan')) + 1);
            }
        }
    });
}

function addDeleteCell(row) {
    const td = document.createElement('td');
    td.className = 'delete-col';
    td.innerHTML = `<button class="delete-btn" onclick="deleteRow(this)" title="Delete Row">×</button>`;
    row.appendChild(td);
}

function deleteRow(btn) {
    if (!confirm('Delete this item?')) return;
    const row = btn.closest('tr');
    row.remove();
    reindexRows();
}

function reindexRows() {
    const rows = document.querySelectorAll('.item-table tbody tr');
    let index = 1;
    rows.forEach(row => {
        const firstCell = row.querySelector('td:first-child');
        if (firstCell && !row.querySelector('td[colspan]')) {
            firstCell.innerText = index++;
        }
    });
}

/**
 * Triggers Browser Print
 */
function printDocument() {
    if (isEditMode) toggleEditMode();
    window.print();
}

/**
 * PDF Generation using html2pdf.js
 */
async function downloadPDF() {
    if (isEditMode) toggleEditMode();

    const originalContainer = document.querySelector('.container');
    const title = document.title || 'Document';
    const btn = document.querySelector('#btn-save');

    document.body.classList.add('pdf-generating');

    const clone = originalContainer.cloneNode(true);
    clone.classList.add('print-mode'); // Apply print styles
    clone.style.width = '190mm'; // Reduced from 210mm to fit 5mm margins (210-5-5=200, safe at 190)
    clone.style.maxWidth = '190mm';
    clone.style.margin = '0 auto';
    clone.style.padding = '0';
    clone.style.boxSizing = 'border-box';

    // Remove delete columns
    clone.querySelectorAll('.delete-col').forEach(el => el.remove());

    // Handle Logo
    const logoImg = clone.querySelector('.logo-section img');
    if (logoImg && logoImg.src) {
        try {
            await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const dataURL = canvas.toDataURL('image/png');
                        logoImg.src = dataURL;
                        resolve();
                    } catch (e) {
                        replaceLogoWithText(logoImg);
                        resolve();
                    }
                };
                img.onerror = () => {
                    replaceLogoWithText(logoImg);
                    resolve();
                };
                img.src = logoImg.src;
            });
        } catch (e) {
            console.warn('Logo processing error', e);
        }
    }

    function replaceLogoWithText(imgElement) {
        const textNode = document.createElement('div');
        textNode.style.fontSize = '24px';
        textNode.style.fontWeight = 'bold';
        textNode.style.color = '#2c3e50';
        textNode.style.marginBottom = '15px';
        textNode.style.fontFamily = 'Montserrat, sans-serif';
        textNode.innerText = 'TRIVANTAS';
        if (imgElement.parentNode) {
            imgElement.parentNode.replaceChild(textNode, imgElement);
        }
    }

    const opt = {
        margin: [10, 5, 10, 5],
        filename: `${title}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    if (typeof html2pdf === 'undefined') {
        alert('PDF Engine loading... please check internet connection.');
        document.body.classList.remove('pdf-generating');
        return;
    }

    try {
        await html2pdf().set(opt).from(clone).save();
    } catch (err) {
        console.error(err);
        alert('Error generating PDF. Please check console.');
    } finally {
        document.body.classList.remove('pdf-generating');
    }
}

/**
 * Add a new row to the table
 */
function addNewRow() {
    const tbody = document.querySelector('.item-table tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');

    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>0</td>
        <td>
            <strong><span contenteditable="true">New Item</span></strong>
            <div style="font-size: 0.85rem; color: #666; margin-top: 2px;"><span contenteditable="true">Description</span></div>
        </td>
        <td class="text-center"><span contenteditable="true">0000</span></td>
        <td class="text-center"><span contenteditable="true">1</span></td>
        <td class="text-right"><span contenteditable="true">0.00</span></td>
        <td class="text-right"><span contenteditable="true">0.00</span></td>
    `;

    addDeleteCell(newRow);

    let insertBeforeNode = null;
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (row.querySelector('td[colspan]')) {
            insertBeforeNode = row;
            break;
        }
    }

    if (insertBeforeNode) {
        tbody.insertBefore(newRow, insertBeforeNode);
    } else {
        tbody.appendChild(newRow);
    }

    reindexRows();

    if (!isEditMode) {
        toggleEditMode();
    } else {
        toggleEditMode(); toggleEditMode();
    }
}

/**
 * Basic Auto-calculation logic
 */
function setupCalculations() {
    // Placeholder for future calculation logic
}

/**
 * Save Bill to Database with Cloudinary PDF upload
 */
async function saveBill() {
    const token = getAuthToken();
    if (!token) {
        alert('Please login to save bills.');
        window.location.href = 'login.html';
        return;
    }

    const invoiceNo = document.querySelector('.meta-item:nth-child(1) .meta-value')?.innerText || 'Unknown';
    const invoiceDate = document.querySelector('.meta-item:nth-child(2) .meta-value')?.innerText || 'Unknown';
    const buyerName = document.querySelectorAll('.address-box')[1]?.querySelector('.address-content strong')?.innerText || 'Unknown Client';
    const totalAmount = document.querySelector('.total-row.final span:last-child')?.innerText || '0.00';
    const billType = getBillType();
    const contentHtml = document.querySelector('.content-wrapper').innerHTML;

    const payload = {
        billType,
        invoiceNo,
        invoiceDate,
        buyerName,
        totalAmount,
        content: { html: contentHtml }
    };

    const saveBtn = document.getElementById('btn-save');
    const originalHtml = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
        saveBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            <span class="btn-text">Saving...</span>
        `;
    }

    try {
        let billId = window.currentBillId;
        let response;

        if (billId) {
            // Update existing bill
            response = await fetch(`${API_URL}/api/bills/${billId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        } else {
            // Create new bill
            response = await fetch(`${API_URL}/api/bills`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || data.msg || 'Failed to save bill');
        }

        const savedBill = await response.json();
        billId = savedBill._id;
        window.currentBillId = billId;

        // Now generate and upload PDF to Cloudinary
        if (saveBtn) {
            saveBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                <span class="btn-text">Uploading...</span>
            `;
        }

        try {
            await uploadPDFToCloudinary(billId);
            alert('✅ Bill saved and PDF uploaded successfully!');
        } catch (pdfError) {
            console.warn('PDF upload failed, bill saved without PDF:', pdfError);
            alert('✅ Bill saved! (PDF upload optional)');
        }

        // Optionally redirect to my-bills
        if (confirm('Bill saved! View all your bills?')) {
            window.location.href = 'my-bills.html';
        }

    } catch (error) {
        console.error('Save Error:', error);
        alert('Failed to save bill: ' + error.message);
    } finally {
        if (saveBtn) saveBtn.innerHTML = originalHtml;
    }
}

/**
 * Upload PDF to Cloudinary
 */
async function uploadPDFToCloudinary(billId) {
    const token = getAuthToken();
    if (!token || !billId) return;

    const container = document.querySelector('.container');
    if (!container) return;

    // Generate PDF as base64
    const clone = container.cloneNode(true);
    clone.classList.add('print-mode'); // Apply print styles
    clone.style.width = '190mm'; // Fit within margins
    clone.style.maxWidth = '190mm';

    // Remove any edit UI elements
    clone.querySelectorAll('.delete-col').forEach(el => el.remove());

    const opt = {
        margin: [5, 0, 5, 0],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Generate PDF and get as base64
    const pdfBlob = await html2pdf().set(opt).from(clone).outputPdf('blob');

    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
    });
    reader.readAsDataURL(pdfBlob);
    const pdfBase64 = await base64Promise;

    // Upload to server
    const response = await fetch(`${API_URL}/api/bills/${billId}/upload-pdf`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pdfBase64 })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'PDF upload failed');
    }

    return await response.json();
}

// Make functions global
window.toggleEditMode = toggleEditMode;
window.downloadPDF = downloadPDF;
window.printDocument = printDocument;
window.addNewRow = addNewRow;
window.deleteRow = deleteRow;
window.saveBill = saveBill;

/**
 * Handle Image Upload for Signature/Stamp
 */
function handleImageUpload(input, imgId) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function (e) {
            const img = document.getElementById(imgId);
            if (img) {
                img.src = e.target.result;
                img.style.display = 'block';
            }
        }

        reader.readAsDataURL(input.files[0]);
    }
}
window.handleImageUpload = handleImageUpload;

/**
 * Handle Image Deletion
 */
function deleteImage(imgId) {
    const img = document.getElementById(imgId);
    if (img) {
        img.src = '';
        img.style.display = 'none';
    }
}
window.deleteImage = deleteImage;

// Add CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .spin {
        animation: spin 1s linear infinite;
    }
`;
document.head.appendChild(style);
