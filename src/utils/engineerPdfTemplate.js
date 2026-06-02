export const generateEngineerPdfHtml = (pdfData) => {
  const { range, dwellingType, floorPlan, facade, package: pkg, propertyDetail, uploadReport, structureEngineerReport } = pdfData;

  const logoUrl = range?.logo_url || "";
  const headerUrl = range?.header_url || "";
  const compactionReportStatus = (uploadReport || structureEngineerReport)
    ? "available"
    : (propertyDetail?.compaction_report || "not_available");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Engineering Requirements</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }
        .container {
          padding: 30px;
          max-width: 900px;
          margin: auto;
        }
        
        /* Banner & Header styling */
        .banner-container {
          width: 100%;
          text-align: center;
          margin-bottom: 25px;
          border-radius: 12px;
          overflow: hidden;
        }
        .banner-container img {
          max-width: 100%;
          height: auto;
          max-height: 120px;
          object-fit: contain;
        }
        .brand-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .brand-logo-box img {
          max-height: 55px;
          width: auto;
          object-fit: contain;
        }
        .brand-title-box {
          text-align: right;
        }
        .brand-title-box h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.5px;
          text-transform: uppercase;
        }
        .brand-title-box p {
          font-size: 13px;
          color: #64748b;
          margin: 4px 0 0 0;
          font-weight: 500;
        }

        /* Section Headings */
        .section-header {
          display: flex;
          align-items: center;
          margin-top: 35px;
          margin-bottom: 18px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 8px;
          page-break-after: avoid;
        }
        .section-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #2563eb;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* Grid & Flex layouts */
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        /* Modern Card styling */
        .card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 20px;
          height: 100%;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .card-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 0;
          margin-bottom: 15px;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 6px;
        }

        /* Lists & Key-Value pairs */
        .info-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 13px;
          border-bottom: 1px dashed #e2e8f0;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .label {
          font-weight: 500;
          color: #64748b;
        }
        .value {
          font-weight: 600;
          color: #1e293b;
          text-align: right;
        }
        .value-highlight {
          color: #2563eb;
          font-weight: 700;
        }

        /* Image Display containers */
        .image-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 15px;
          margin-top: 15px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .image-card img {
          max-width: 100%;
          height: auto;
          max-height: 280px;
          border-radius: 8px;
          object-fit: contain;
        }
        .image-title {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 10px;
          margin-bottom: 0;
        }

        /* Page-break utility */
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Optional Top Banner -->
        ${headerUrl ? `<div class="banner-container"><img src="${headerUrl}" alt="Header Banner"></div>` : ''}

        <!-- Brand Header Section -->
        <div class="brand-header">
          <div class="brand-logo-box">
            ${logoUrl ? `<img src="${logoUrl}" alt="Brand Logo">` : `<div style="font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -1px;">inBuildify</div>`}
          </div>
          <div class="brand-title-box">
            <h1>Engineering Spec</h1>
            <p>Structural Requirements Report</p>
          </div>
        </div>

        <!-- General & Package Details (Side-by-side) -->
        <div class="grid-2">
          <!-- General Details Card -->
          <div class="card">
            <h3 class="card-title">General Details</h3>
            <ul class="info-list">
              <li class="info-item">
                <span class="label">Range</span>
                <span class="value">${range?.name || 'N/A'}</span>
              </li>
              <li class="info-item">
                <span class="label">Dwelling Type</span>
                <span class="value">${dwellingType?.name || 'N/A'}</span>
              </li>
            </ul>
          </div>

          <!-- Package Details Card -->
          <div class="card">
            <h3 class="card-title">Package Details</h3>
            ${pkg ? `
              <ul class="info-list">
                <li class="info-item">
                  <span class="label">Package Name</span>
                  <span class="value-highlight">${pkg.name || 'N/A'}</span>
                </li>
                <li class="info-item">
                  <span class="label">Total Cost</span>
                  <span class="value" style="color: #10b981;">$${parseFloat(pkg.cost || 0).toLocaleString()}</span>
                </li>
                <li class="info-item">
                  <span class="label">Builder Cost</span>
                  <span class="value" style="color: #10b981;">$${parseFloat(pkg.builder_cost || 0).toLocaleString()}</span>
                </li>
              </ul>
            ` : `
              <div style="display: flex; height: calc(100% - 30px); align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; font-weight: 500;">
                No package selected
              </div>
            `}
          </div>
        </div>

        <!-- Floor Plan Section -->
        <div class="section-header">
          <h2>1. Floor Plan Specifications</h2>
        </div>

        <div class="card" style="background: #ffffff; padding: 22px;">
          <h3 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
            ${floorPlan?.name || 'N/A'}
          </h3>
          ${floorPlan?.description ? `<p style="font-size: 13px; color: #64748b; margin-top: 0; margin-bottom: 20px; line-height: 1.6;">${floorPlan.description}</p>` : ''}
          
          <div class="grid-2" style="margin-top: 15px;">
            <ul class="info-list">
              <li class="info-item">
                <span class="label">Min Land Width</span>
                <span class="value">${floorPlan?.min_land_width || 'N/A'} m</span>
              </li>
              <li class="info-item">
                <span class="label">Min Land Depth</span>
                <span class="value">${floorPlan?.min_land_depth || 'N/A'} m</span>
              </li>
              <li class="info-item">
                <span class="label">Total Area</span>
                <span class="value-highlight">${floorPlan?.total_area || 'N/A'} sqm</span>
              </li>
              <li class="info-item">
                <span class="label">Dwelling Area</span>
                <span class="value">${floorPlan?.dwelling_area || 'N/A'} sqm</span>
              </li>
              <li class="info-item">
                <span class="label">Garage Area</span>
                <span class="value">${floorPlan?.garage_area || 'N/A'} sqm</span>
              </li>
              <li class="info-item">
                <span class="label">Porch Area</span>
                <span class="value">${floorPlan?.porch_area || 'N/A'} sqm</span>
              </li>
            </ul>

            <ul class="info-list">
              <li class="info-item">
                <span class="label">Bedrooms</span>
                <span class="value">${floorPlan?.beds || 'N/A'}</span>
              </li>
              <li class="info-item">
                <span class="label">Bathrooms</span>
                <span class="value">${floorPlan?.baths || 'N/A'}</span>
              </li>
              <li class="info-item">
                <span class="label">Living Areas</span>
                <span class="value">${floorPlan?.living || 'N/A'}</span>
              </li>
              <li class="info-item">
                <span class="label">Carparks</span>
                <span class="value">${floorPlan?.carpark || 'N/A'}</span>
              </li>
            </ul>
          </div>

          <!-- Floor Plan Image Rendering -->
          ${floorPlan?.detailed_image ? `
            <div class="image-card">
              <img src="${floorPlan.detailed_image}" alt="Detailed Floor Plan">
              <p class="image-title">Detailed Layout View</p>
            </div>
          ` : (floorPlan?.simple_image ? `
            <div class="image-card">
              <img src="${floorPlan.simple_image}" alt="Floor Plan">
              <p class="image-title">Floor Plan Layout</p>
            </div>
          ` : '')}
        </div>

        <!-- Facade Section -->
        <div class="page-break"></div>
        
        <div class="section-header" style="margin-top: 0;">
          <h2>2. Facade Specifications</h2>
        </div>

        <div class="card" style="background: #ffffff; padding: 22px;">
          <h3 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 15px;">
            ${facade?.name || 'N/A'}
          </h3>
          
          <div class="grid-2" style="margin-bottom: 20px;">
            <div class="card" style="background: #f8fafc; padding: 15px 20px;">
              <ul class="info-list">
                <li class="info-item">
                  <span class="label">Cost Type</span>
                  <span class="value" style="text-transform: capitalize;">${facade?.cost_type || 'N/A'}</span>
                </li>
              </ul>
            </div>
            <div class="card" style="background: #f8fafc; padding: 15px 20px;">
              <ul class="info-list">
                <li class="info-item">
                  <span class="label">Retail Cost</span>
                  <span class="value" style="color: #10b981; font-weight: 700;">$${parseFloat(facade?.cost || 0).toLocaleString()}</span>
                </li>
                <li class="info-item">
                  <span class="label">Builder Cost</span>
                  <span class="value" style="color: #10b981; font-weight: 700;">$${parseFloat(facade?.builder_cost || 0).toLocaleString()}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Facade Image Rendering -->
          ${facade?.image ? `
            <div class="image-card">
              <img src="${facade.image}" alt="Facade Rendering">
              <p class="image-title">External Facade Rendering</p>
            </div>
          ` : ''}
        </div>

        <!-- Property & Site Section -->
        <div class="page-break"></div>
        
        <div class="section-header" style="margin-top: 0;">
          <h2>3. Property & Site Specifications</h2>
        </div>

        <div class="card" style="background: #ffffff; padding: 22px;">
          ${propertyDetail ? `
            <h3 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 15px;">
              Lot ${propertyDetail.lot_number || 'N/A'}, ${propertyDetail.street || 'N/A'}
            </h3>
            
            <div class="grid-2">
              <ul class="info-list">
                <li class="info-item">
                  <span class="label">Estate Name</span>
                  <span class="value">${propertyDetail.estate_name || 'N/A'}</span>
                </li>
                <li class="info-item">
                  <span class="label">City / Suburb</span>
                  <span class="value">${propertyDetail.city || 'N/A'}</span>
                </li>
                <li class="info-item">
                  <span class="label">Postcode</span>
                  <span class="value">${propertyDetail.zip_code || 'N/A'}</span>
                </li>
                <li class="info-item">
                  <span class="label">Title Status</span>
                  <span class="value" style="text-transform: uppercase; font-size: 11px;">${propertyDetail.title_status || 'N/A'}</span>
                </li>
                <li class="info-item">
                  <span class="label">Title Date</span>
                  <span class="value">${propertyDetail.title_date ? new Date(propertyDetail.title_date).toLocaleDateString() : 'N/A'}</span>
                </li>
              </ul>

              <ul class="info-list">
                <li class="info-item">
                  <span class="label">Land Width</span>
                  <span class="value">${propertyDetail.width_m || 'N/A'} m</span>
                </li>
                <li class="info-item">
                  <span class="label">Land Depth</span>
                  <span class="value">${propertyDetail.depth_m || 'N/A'} m</span>
                </li>
                <li class="info-item">
                  <span class="label">Total Size</span>
                  <span class="value-highlight">${propertyDetail.total_size_m2 || 'N/A'} sqm</span>
                </li>
                <li class="info-item">
                  <span class="label">Site Fall</span>
                  <span class="value">${propertyDetail.site_fall_mm || 'N/A'} mm</span>
                </li>
                <li class="info-item">
                  <span class="label">Land Fill</span>
                  <span class="value">${propertyDetail.land_fill_mm || 'N/A'} mm</span>
                </li>
              </ul>
            </div>

            <div class="grid-2" style="margin-top: 20px;">
              <div class="card" style="background: #f8fafc; padding: 15px 20px;">
                <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Soil & Environment</h4>
                <ul class="info-list">
                  <li class="info-item">
                    <span class="label">Land Type / Classification</span>
                    <span class="value" style="color: #2563eb;">${propertyDetail.land_type || 'N/A'}</span>
                  </li>
                  <li class="info-item">
                    <span class="label">Bush Fire Zone</span>
                    <span class="value">${propertyDetail.bush_fire ? '<span style="color: #ef4444; font-weight: 700;">YES</span>' : 'NO'}</span>
                  </li>
                  <li class="info-item">
                    <span class="label">Corner Block</span>
                    <span class="value">${propertyDetail.corner_block ? 'YES' : 'NO'}</span>
                  </li>
                </ul>
              </div>

              <div class="card" style="background: #f8fafc; padding: 15px 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Soil Compaction Report</h4>
                <p style="font-size: 12px; color: #64748b; margin: 0 0 15px 0;">
                  Status: <strong style="color: #1e293b; text-transform: uppercase;">${compactionReportStatus}</strong>
                </p>
                ${propertyDetail?.compaction_report_download_url ? `
                  <a href="${propertyDetail.compaction_report_download_url}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 4px rgba(37,99,235,0.2); transition: all 0.2s ease;">
                    📥 Download Soil Report
                  </a>
                ` : `
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 500; font-style: italic;">
                    No document link available
                  </div>
                `}
              </div>
            </div>
          ` : `
            <div style="text-align: center; padding: 30px 0; color: #94a3b8; font-size: 14px; font-weight: 500;">
              No property or site specifications listed.
            </div>
          `}
        </div>

      </div>
    </body>
    </html>
  `;
};
