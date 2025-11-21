import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import QRCode from "qrcode";

const CompanyQRCode = () => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData?.role !== "company_admin") {
      navigate("/dashboard");
      return;
    }
    loadCompanyAndGenerateQR();
  }, [userData, navigate]);

  const loadCompanyAndGenerateQR = async () => {
    setLoading(true);
    try {
      // Load company data
      const companyDoc = await getDoc(doc(db, "companies", userData.companyId));

      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() };
        setCompany(companyData);

        // Generate QR code
        await generateQRCode(companyData);
      }
    } catch (error) {
      console.error("Error loading company:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (companyData) => {
    try {
      const qrData = JSON.stringify({
        companyId: companyData.id,
        companyName: companyData.name,
        type: "company_registration",
      });

      const url = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        color: {
          dark: "#0284c7",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      });

      setQrCodeUrl(url);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl || !company) return;

    // Create a canvas to render the full document
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size for a document (2 pages at 800px width)
    canvas.width = 800;
    canvas.height = 2200; // Increased height for 2 pages

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load logo image
    const logoImage = new Image();
    logoImage.crossOrigin = 'anonymous';
    logoImage.src = window.location.origin + '/logo.png';

    // Load QR code image
    const qrImage = new Image();
    qrImage.crossOrigin = 'anonymous';

    let imagesLoaded = 0;
    const totalImages = 2;

    const onImageLoad = () => {
      imagesLoaded++;
      if (imagesLoaded === totalImages) {
        drawCanvas();
      }
    };

    logoImage.onload = onImageLoad;
    qrImage.onload = onImageLoad;

    const drawCanvas = () => {
      // PAGE 1 - QR Code and Company Info
      let yPosition = 60;

      // Draw VoxWel Logo
      const logoSize = 80;
      const logoX = (canvas.width - logoSize) / 2;
      const logoY = yPosition;
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

      yPosition = 150;

      // Title
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 48px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(company.name, 400, yPosition);

      yPosition += 50;

      // Subtitle - VoxWel
      ctx.fillStyle = '#6b7280';
      ctx.font = '600 24px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('VoxWel', 400, yPosition);

      yPosition += 40;

      // Tagline
      ctx.fillStyle = '#9ca3af';
      ctx.font = '20px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('Where Every Voice Matters', 400, yPosition);

      yPosition += 60;

      // Draw QR code
      const qrSize = 400;
      const qrX = (canvas.width - qrSize) / 2;
      ctx.drawImage(qrImage, qrX, yPosition, qrSize, qrSize);

      yPosition += qrSize + 40;

      // Scan instruction
      ctx.fillStyle = '#374151';
      ctx.font = '600 22px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('📱 Scan this code with your phone camera', 400, yPosition);

      yPosition += 60;

      // PAGE 2 - Instructions (starts at y = 1100)
      yPosition = 1100;

      // Draw logo on page 2
      const logoSize2 = 60;
      const logoX2 = (canvas.width - logoSize2) / 2;
      ctx.drawImage(logoImage, logoX2, yPosition, logoSize2, logoSize2);

      yPosition = 1200;

      // Page 2 title
      ctx.textAlign = 'center';
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 36px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('How to Join ' + company.name, 400, yPosition);

      yPosition += 70;

      // Instructions box
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect(60, yPosition, 680, 350);
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, yPosition, 680, 350);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 22px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('📋 Registration Steps', 90, yPosition + 45);

      ctx.fillStyle = '#1f2937';
      ctx.font = '18px Inter, system-ui, -apple-system, sans-serif';
      const instructions = [
        '1. Open your phone camera or QR scanner app',
        '2. Point your camera at the QR code above',
        '3. Tap the notification that appears',
        '4. Complete the registration form with your details',
        '5. Wait for HR administrator approval',
        '6. Start engaging with your team!'
      ];

      let instrY = yPosition + 90;
      instructions.forEach((instruction) => {
        ctx.fillText(instruction, 90, instrY);
        instrY += 40;
      });

      yPosition += 380;

      // Benefits box
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(60, yPosition, 680, 240);
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, yPosition, 680, 240);

      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 22px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('🌟 What You Will Get', 90, yPosition + 45);

      ctx.fillStyle = '#78350f';
      ctx.font = '17px Inter, system-ui, -apple-system, sans-serif';
      const benefits = [
        '✓ Share ideas anonymously        ✓ Report workplace issues',
        '✓ Engage with colleagues          ✓ Track your contributions',
        '✓ Get recognized for input        ✓ Shape company culture'
      ];

      let benefitY = yPosition + 90;
      benefits.forEach((benefit) => {
        ctx.fillText(benefit, 90, benefitY);
        benefitY += 45;
      });

      yPosition += 270;

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText(`© 2025 ${company.name} • VoxWel`, 400, yPosition);

      ctx.font = '14px Courier New, monospace';
      ctx.fillText(`Company ID: ${company.id}`, 400, yPosition + 30);

      // Download the canvas as image
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${company.name.replace(/\s+/g, '_')}_VoxWel_QR_Code.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    };

    qrImage.src = qrCodeUrl;
  };

  const printQRCode = () => {
    if (!qrCodeUrl || !company) return;

    const printWindow = window.open("", "_blank");
    const logoUrl = window.location.origin + '/logo.png';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code - ${company.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              background: white;
              padding: 0;
            }

            .page {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              padding: 40px 40px;
              page-break-after: always;
            }

            .page:last-child {
              page-break-after: auto;
            }

            .print-container {
              background: white;
              max-width: 700px;
              width: 100%;
              text-align: center;
            }
            
            .header {
              margin-bottom: 30px;
            }

            .logo {
              width: 80px;
              height: 80px;
              margin: 0 auto 20px;
              display: block;
              object-fit: contain;
            }
            
            .company-name {
              font-size: 36px;
              font-weight: 700;
              color: #111827;
              margin-bottom: 12px;
              line-height: 1.2;
            }
            
            .platform-name {
              font-size: 18px;
              color: #6b7280;
              font-weight: 500;
              margin-bottom: 8px;
            }
            
            .subtitle {
              font-size: 16px;
              color: #9ca3af;
              margin-bottom: 20px;
            }
            
            .divider {
              width: 100px;
              height: 4px;
              background: linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%);
              margin: 0 auto 40px;
              border-radius: 2px;
            }
            
            .qr-container {
              background: white;
              padding: 30px;
              border-radius: 24px;
              box-shadow: 0 0 0 12px #f0f9ff, 0 8px 24px rgba(0, 0, 0, 0.1);
              display: inline-block;
              margin-bottom: 30px;
            }
            
            .qr-container img {
              display: block;
              width: 350px;
              height: 350px;
              border-radius: 12px;
            }

            .scan-text {
              font-size: 18px;
              color: #374151;
              font-weight: 600;
              margin-bottom: 20px;
            }
            
            .instructions {
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              padding: 32px;
              border-radius: 16px;
              text-align: left;
              margin: 40px 0;
              border: 2px solid #bae6fd;
            }
            
            .instructions-header {
              display: flex;
              align-items: center;
              margin-bottom: 20px;
            }
            
            .instructions-icon {
              width: 32px;
              height: 32px;
              background: #0284c7;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 12px;
            }
            
            .instructions h3 {
              color: #0369a1;
              font-size: 20px;
              font-weight: 700;
              margin: 0;
            }
            
            .instructions ol {
              margin: 0;
              padding-left: 24px;
              counter-reset: item;
            }
            
            .instructions li {
              margin-bottom: 12px;
              color: #1f2937;
              font-size: 15px;
              line-height: 1.6;
              position: relative;
              padding-left: 8px;
            }
            
            .instructions li:last-child {
              margin-bottom: 0;
            }
            
            .benefits {
              background: #fef3c7;
              border: 2px solid #fcd34d;
              padding: 24px;
              border-radius: 12px;
              margin: 30px 0;
            }
            
            .benefits h4 {
              color: #92400e;
              font-size: 16px;
              font-weight: 700;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .benefits ul {
              list-style: none;
              padding: 0;
              margin: 0;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            
            .benefits li {
              color: #78350f;
              font-size: 14px;
              display: flex;
              align-items: center;
            }
            
            .benefits li:before {
              content: "✓";
              display: inline-block;
              width: 20px;
              height: 20px;
              background: #fbbf24;
              color: #78350f;
              border-radius: 50%;
              text-align: center;
              line-height: 20px;
              font-weight: bold;
              margin-right: 8px;
              flex-shrink: 0;
            }
            
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
            }
            
            .company-id {
              display: inline-block;
              background: #f3f4f6;
              padding: 12px 24px;
              border-radius: 8px;
              margin-bottom: 16px;
            }
            
            .company-id strong {
              color: #374151;
              font-size: 14px;
              font-weight: 600;
            }
            
            .company-id span {
              color: #6b7280;
              font-size: 12px;
              font-family: 'Courier New', monospace;
              margin-left: 8px;
            }
            
            .copyright {
              color: #9ca3af;
              font-size: 13px;
              margin-top: 12px;
            }
            
            @media print {
              body {
                background: white;
                padding: 0;
              }

              .page {
                min-height: 100vh;
                page-break-after: always;
                page-break-inside: avoid;
              }

              .page:last-child {
                page-break-after: auto;
              }

              .print-container {
                box-shadow: none;
                max-width: 100%;
              }

              .qr-container {
                box-shadow: none;
              }
            }

            @page {
              size: A4;
              margin: 1cm;
            }
          </style>
        </head>
        <body>
          <!-- PAGE 1: QR CODE -->
          <div class="page">
            <div class="print-container">
              <div class="header">
                <img src="${logoUrl}" alt="VoxWel Logo" class="logo" />

                <h1 class="company-name">${company.name}</h1>
                <p class="platform-name">VoxWel - Where Every Voice Matters</p>
                <p class="subtitle">Scan to Join Our Team</p>
                <div class="divider"></div>
              </div>

              <div class="qr-container">
                <img src="${qrCodeUrl}" alt="Company QR Code" />
              </div>

              <p class="scan-text">📱 Scan this code with your phone camera</p>

              <div class="footer">
                <div class="company-id">
                  <strong>Company ID:</strong>
                  <span>${company.id}</span>
                </div>
                <p class="copyright">© 2025 ${company.name} • VoxWel</p>
              </div>
            </div>
          </div>

          <!-- PAGE 2: INSTRUCTIONS -->
          <div class="page">
            <div class="print-container">
              <div class="header">
                <img src="${logoUrl}" alt="VoxWel Logo" class="logo" />
                <h1 class="company-name">How to Join</h1>
                <div class="divider"></div>
              </div>

              <div class="instructions">
              <div class="instructions-header">
                <div class="instructions-icon">
                  <svg width="16" height="16" fill="white" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
                <h3>How to Join ${company.name}</h3>
              </div>
              <ol>
                <li>Open your phone's camera or QR code scanner app</li>
                <li>Point your camera at this QR code above</li>
                <li>Tap the notification that appears on your screen</li>
                <li>Complete the registration form with your details</li>
                <li>Wait for approval from your HR administrator</li>
                <li>Start engaging with your team and sharing your voice!</li>
              </ol>
            </div>
            
              <div class="benefits">
                <h4>🌟 What You'll Get:</h4>
                <ul>
                  <li>Share ideas anonymously</li>
                  <li>Report workplace issues</li>
                  <li>Engage with colleagues</li>
                  <li>Track your contributions</li>
                  <li>Get recognized for input</li>
                  <li>Shape company culture</li>
                </ul>
              </div>

              <div class="footer">
                <p class="copyright">© 2025 ${company.name} • VoxWel</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const shareQRCode = async () => {
    if (!qrCodeUrl || !company) return;

    try {
      // Create a canvas to render the share image with logo, app name, tagline, company name and QR
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size
      canvas.width = 800;
      canvas.height = 900;

      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Load logo image
      const logoImage = new Image();
      logoImage.crossOrigin = 'anonymous';
      logoImage.src = window.location.origin + '/logo.png';

      // Load QR code image
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';

      let imagesLoaded = 0;
      const totalImages = 2;

      const onImageLoad = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
          drawShareCanvas();
        }
      };

      logoImage.onload = onImageLoad;
      qrImage.onload = onImageLoad;

      const drawShareCanvas = async () => {
        let yPosition = 60;

        // Draw VoxWel Logo
        const logoSize = 100;
        const logoX = (canvas.width - logoSize) / 2;
        ctx.drawImage(logoImage, logoX, yPosition, logoSize, logoSize);

        yPosition += logoSize + 30;

        // App Name - VoxWel
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 48px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VoxWel', 400, yPosition);

        yPosition += 50;

        // Tagline
        ctx.fillStyle = '#6b7280';
        ctx.font = '24px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText('Where Every Voice Matters', 400, yPosition);

        yPosition += 60;

        // Company Name
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 36px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText(company.name, 400, yPosition);

        yPosition += 60;

        // Draw QR code
        const qrSize = 400;
        const qrX = (canvas.width - qrSize) / 2;
        ctx.drawImage(qrImage, qrX, yPosition, qrSize, qrSize);

        yPosition += qrSize + 30;

        // Scan instruction
        ctx.fillStyle = '#374151';
        ctx.font = '600 20px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText('📱 Scan to Join Our Team', 400, yPosition);

        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          const file = new File([blob], `${company.name}_VoxWel_QR.png`, {
            type: "image/png",
          });

          const shareText = `Join ${company.name} on VoxWel!\n\n` +
            `📱 Scan the QR code to register:\n` +
            `1. Open your phone camera\n` +
            `2. Point at the QR code\n` +
            `3. Tap the notification\n` +
            `4. Complete registration\n` +
            `5. Wait for HR approval\n` +
            `6. Start engaging with your team!\n\n` +
            `VoxWel - Where Every Voice Matters`;

          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Join ${company.name} on VoxWel`,
              text: shareText,
              files: [file],
            });
          } else {
            const shareUrl = `${window.location.origin}/join/${company.id}`;
            const fullShareText = `${shareText}\n\nOr visit: ${shareUrl}`;
            await navigator.clipboard.writeText(fullShareText);
            alert("Share information copied to clipboard!");
          }
        });
      };

      qrImage.src = qrCodeUrl;
    } catch (error) {
      console.error("Error sharing:", error);
      alert("Unable to share. Please download and share manually.");
    }
  };

  const copyCompanyId = () => {
    navigator.clipboard.writeText(company.id);
    alert("Company ID copied to clipboard!");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Company QR Code
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {userData?.displayName || userData?.username}
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                COMPANY ADMIN
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Your Company QR Code
          </h2>
          <p className="text-gray-600">
            Share this QR code with employees to join your company platform
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side - Company Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Company Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Company Details
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Company Name
                  </label>
                  <p className="text-gray-900 font-semibold mt-1">
                    {company?.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Industry
                  </label>
                  <p className="text-gray-900 mt-1">
                    {company?.industry || "Not specified"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Company ID
                  </label>
                  <div className="flex items-center mt-1">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 flex-1">
                      {company?.id}
                    </code>
                    <button
                      onClick={copyCompanyId}
                      className="ml-2 text-primary-600 hover:text-primary-700"
                      title="Copy Company ID"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Status
                  </label>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        company?.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {company?.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Employees
                  </label>
                  <p className="text-gray-900 font-semibold mt-1">
                    {company?.employeeCount || 0}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Side - QR Code */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-8">
              {/* QR Code Display */}
              <div className="flex flex-col items-center mb-8">
                <div className="bg-white p-8 rounded-2xl border-2 border-primary-200 shadow-xl mb-6">
                  {qrCodeUrl && (
                    <img
                      src={qrCodeUrl}
                      alt="Company QR Code"
                      className="w-80 h-80"
                    />
                  )}
                </div>
                <p className="text-center text-gray-600 max-w-md mb-6">
                  Employees can scan this QR code to quickly register and join
                  your company platform
                </p>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl">
                  <button
                    onClick={downloadQRCode}
                    className="flex items-center justify-center px-6 py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition shadow-lg"
                  >
                    <svg
                      className="w-6 h-6 mr-2 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span className="text-base">Download</span>
                  </button>

                  <button
                    onClick={printQRCode}
                    className="flex items-center justify-center px-6 py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition shadow-lg"
                  >
                    <svg
                      className="w-6 h-6 mr-2 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    <span className="text-base">Print</span>
                  </button>

                  <button
                    onClick={shareQRCode}
                    className="flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition shadow-lg"
                  >
                    <svg
                      className="w-6 h-6 mr-2 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    <span className="text-base">Share</span>
                  </button>
                </div>
              </div>

              {/* Usage Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">
                        Distribution Tips
                      </h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Email to new employees</li>
                        <li>• Print on welcome packets</li>
                        <li>• Display in common areas</li>
                        <li>• Add to employee handbook</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-semibold text-green-900 mb-2">
                        Best Practices
                      </h4>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• High resolution for printing</li>
                        <li>• Test scan before distribution</li>
                        <li>• Keep QR code accessible</li>
                        <li>• Monitor registration activity</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompanyQRCode;
