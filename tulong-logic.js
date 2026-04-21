
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
        import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js"; 
        const firebaseConfig = {
            apiKey: "AIzaSyDtYoKpqYE8MDc1dbZANQWwLxpp-heTBr8",
            authDomain: "tulongtech-7de22.firebaseapp.com",
            databaseURL: "https://tulongtech-7de22-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "tulongtech-7de22",
            storageBucket: "tulongtech-7de22.firebasestorage.app",
            messagingSenderId: "924023247315",
            appId: "1:924023247315:web:45f4d22dc0e6c8436f1f26",
            measurementId: "G-9MZ3JX8J7N"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getDatabase(app);
        const locationsRef = ref(db, 'live_locations');
        

        // Expose signOut so our button can reach it
        window.firebaseSignOut = () => signOut(auth);

        // Protect the page: Redirect if not logged in
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                window.location.href = 'index.html';
            }
        });
   

    
        window.deleteIncident = function(id) {
    const data = activeIncidentMarkers[id];
    
    if (data) {
        // 1. Remove the marker from the Leaflet map
        map.removeLayer(data.marker);

        // 2. Decrement the counters only if it wasn't already resolved
        if (!data.isResolved) {
            if (data.type === 'fire') {
                incidentCounts.fire = Math.max(0, incidentCounts.fire - 1);
            } else {
                incidentCounts.med = Math.max(0, incidentCounts.med - 1);
            }
        }

        // 3. Remove from our tracking object
        delete activeIncidentMarkers[id];

        // 4. Update the UI Sidebar and Map Overlay
        updateGlobalStats();
        
        console.log(`Incident ${id} deleted.`);
    }
};
// Make sure this is declared globally
if (typeof vehicleMarkers === 'undefined') {
    var vehicleMarkers = {}; 
}


onValue(locationsRef, (snapshot) => {
    const vehicles = snapshot.val() || {};

    // --- 1. RESET COUNTERS ---
    // This ensures that when someone logs out, the count actually goes down
    liveUnitCounts.trucks = 0;
    liveUnitCounts.ambs = 0;

    // 2. Cleanup: Remove markers for units no longer in Firebase
    Object.keys(vehicleMarkers).forEach(id => {
        if (!vehicles[id]) {
            map.removeLayer(vehicleMarkers[id]);
            delete vehicleMarkers[id];
        }
    });

    // 3. Process Active Units
    Object.keys(vehicles).forEach(unitId => {
        const v = vehicles[unitId];
        if (!v || !v.lat || !v.lng) return;

        // --- THE SPECIFIC LOGIC FOR THE UNDERSCORE ---
        const parts = unitId.split('_'); 
        const typePart = parts[1] ? parts[1].toUpperCase() : ""; 

        let selectedIcon;

        // --- 4. ASSIGN ICON AND INCREMENT COUNTERS ---
        if (typePart === "AMBU") {
            selectedIcon = ambulanceIcon;
            liveUnitCounts.ambs++; // Add to Live Ambulance count
        } else if (typePart === "TRUCK") {
            selectedIcon = truckIcon;
            liveUnitCounts.trucks++; // Add to Live Truck count
        } else {
            selectedIcon = L.Icon.Default; 
        }

        // Marker Management
        if (!vehicleMarkers[unitId]) {
            vehicleMarkers[unitId] = L.marker([v.lat, v.lng], { icon: selectedIcon })
                .addTo(map)
                .bindPopup(`<b>Unit: ${unitId.toUpperCase()}</b><br>Status: ${v.status || 'Active'}`);
        } else {
            vehicleMarkers[unitId].setLatLng([v.lat, v.lng]);
            vehicleMarkers[unitId].setIcon(selectedIcon);
            vehicleMarkers[unitId].getPopup().setContent(`<b>Unit: ${unitId.toUpperCase()}</b><br>Status: ${v.status || 'Active'}`);
        }
    });

    // --- 5. REFRESH THE UI OVERLAY ---
    // This pushes the new numbers to the top-right box on the map
    if (typeof infoCounter !== 'undefined') {
        infoCounter.update();
    }
});
        let incidentCounter = 1;
        let lastResetDate = new Date().toDateString();
        // MAP INITIALIZATION
        const map = L.map('map').setView([10.3157, 123.8854], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        const cebuBounds = L.latLngBounds([9.390, 123.230], [11.350, 124.150]);

        const geocoder = L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: "Search Cebu/Mactan streets...",
            errorMessage: "Location not found in service area.",
            geocoder: L.Control.Geocoder.nominatim({
                geocodingQueryParams: {
                    viewbox: '123.230,9.390,124.150,11.350',
                    bounded: 1
                }
            })
        })
        .on('markgeocode', function(e) {
            const center = e.geocode.center;
            if (cebuBounds.contains(center)) {
                map.flyTo(center, 18);
                const searchMarker = L.circle(center, { color: '#4da3ff', fillColor: '#4da3ff', fillOpacity: 0.2, radius: 50 }).addTo(map);
                setTimeout(() => map.removeLayer(searchMarker), 5000);
            } else {
                alert("Search result is outside the T.U.L.O.N.G. coverage area.");
            }
        })
        .addTo(map);

        const fireIcon = L.icon({ iconUrl: "fireStation1.png", iconSize: [30, 30] });
        const volunteerIcon = L.icon({ iconUrl: "volunteerStation1.png", iconSize: [30, 30] });
        const truckIcon = L.icon({ iconUrl: "firetruck.png", iconSize: [25, 25] });
        const ambulanceIcon = L.icon({ iconUrl: "AMBULANCE.png", iconSize: [35, 35] });

        let isReporting = false;
        let incidentCounts = { fire: 0, med: 0 };
        let liveUnitCounts = { trucks: 0, ambs: 0 };
        let activeIncidentMarkers = {}; 
        let dailyReportLog = [];

        const infoCounter = L.control({position: 'topright'});
        infoCounter.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'map-counter-overlay');
            this.update();
            return this._div;
        };
        infoCounter.update = function () {
            this._div.innerHTML = `
                <div style="font-size: 10px; color: #888; text-align:center; margin-bottom:8px;">LIVE TRACKING</div>
                <div class="map-counter-item"><span>🚒 FIRETRUCKS</span><span class="count-val-red">${liveUnitCounts.trucks}</span></div>
                <div class="map-counter-item"><span>🚑 AMBULANCES</span><span class="count-val-blue">${liveUnitCounts.ambs}</span></div>
                <hr style="border:0; border-top:1px solid #4da3ff; margin:10px 0;">
                <div style="font-size: 10px; color: #ffcc00; text-align:center; margin-bottom:8px;">ACTIVE INCIDENTS</div>
                <div class="map-counter-item"><span>🔥 FIRE</span><span class="count-val-yellow">${incidentCounts.fire}</span></div>
                <div class="map-counter-item"><span>⚕️ MEDICAL</span><span class="count-val-yellow">${incidentCounts.med}</span></div>
            `;
        };
        infoCounter.addTo(map);

        async function getAddress(lat, lng) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
                const data = await response.json();
                const addr = data.address;
                const area = addr.quarter || addr.suburb || addr.village || addr.neighbourhood || "Unknown Area";
                const city = addr.city || addr.town || "Cebu";
                return `Brgy ${area}, ${city}`;
            } catch (e) { return "Address Unavailable"; }
        }

        const reportBtn = document.getElementById('report-toggle');
        reportBtn.onclick = () => {
            isReporting = !isReporting;
            reportBtn.innerText = isReporting ? "Click map location..." : "⚠️ Report Emergency";
            reportBtn.classList.toggle('report-active');
            map.getContainer().style.cursor = isReporting ? 'crosshair' : '';
        };

        map.on('click', async function(e) {
            if (!isReporting) return;
            const address = await getAddress(e.latlng.lat, e.latlng.lng);
            const popupHTML = `
                <div style="text-align:center; color:black;">
                    <b>NEW EMERGENCY</b><br><small>${address}</small><br>
                    <button onclick="placeIncident('fire', ${e.latlng.lat}, ${e.latlng.lng}, '${address}')" style="background:#ff4d4d; color:white; border:none; padding:8px; margin:5px; cursor:pointer; font-weight:bold;">🔥 FIRE</button>
                    <button onclick="placeIncident('med', ${e.latlng.lat}, ${e.latlng.lng}, '${address}')" style="background:#4da3ff; color:white; border:none; padding:8px; margin:5px; cursor:pointer; font-weight:bold;">⚕️ MEDICAL</button>
                </div>
            `;
            L.popup().setLatLng(e.latlng).setContent(popupHTML).openOn(map);
            isReporting = false;
            reportBtn.innerText = "⚠️ Report Emergency";
            reportBtn.classList.remove('report-active');
            map.getContainer().style.cursor = '';
        });

        window.placeIncident = function(type, lat, lng, address) {
    const iconEmoji = type === 'fire' ? '🔥' : '⚕️'; 
    const now = new Date();
    const currentDateString = now.toDateString();

    // --- AUTO-RESET COUNTER IF IT'S A NEW DAY ---
    if (currentDateString !== lastResetDate) {
        incidentCounter = 1;
        lastResetDate = currentDateString;
    }

    // --- FORMAT DATE FOR ID (YYYYMMDD) ---
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const formattedDate = `${year}${month}${day}`; 
    
    // --- FORMAT ID (5-digit padding) ---
    const paddedCount = String(incidentCounter).padStart(5, '0');
    const id = `INC-${formattedDate}-${paddedCount}`;
    
    incidentCounter++;

    const marker = L.marker([lat, lng], {
        icon: L.divIcon({ 
            html: `<div id="icon-inner-${id}" style="text-align:center;">
                    <div style="font-size:30px;">${iconEmoji}</div>
                    <div id="label-${id}" style="background:rgba(0,0,0,0.8); color:white; font-size:10px; font-weight:bold; padding:2px 4px; border-radius:3px; white-space:nowrap; display:none; border: 1px solid #4da3ff;"></div>
                   </div>`, 
            className: 'incident-marker', 
            iconSize: [40, 50],
            iconAnchor: [20, 25]
        })
    }).addTo(map);

    activeIncidentMarkers[id] = {
        marker: marker, 
        type: type, 
        lat: lat, 
        lng: lng, 
        address: address,
        startTime: now,
        // CHANGED: "Reported" is now "For Verification"
        timeline: [`[${now.toLocaleTimeString()}] For Verification`], 
        status: "For Verification", 
        alarm: "N/A", 
        isResolved: false
    };

    if(type === 'fire') incidentCounts.fire++; else incidentCounts.med++;
    updateGlobalStats();
    updatePopup(id);
};
        

        window.updatePopup = function(id) {
    const data = activeIncidentMarkers[id];
    if (data.isResolved) {
        let resolvedInfo = `<b>RESOLVED ${data.type.toUpperCase()}</b><br><small>${data.address}</small><hr>Type: ${data.status}`;
        data.marker.bindPopup(`<div style="color:black;">${resolvedInfo}</div>`).openPopup();
        return;
    }

    let content = `<div style="color:black; min-width: 220px;">
        <b style="text-transform:uppercase;">${data.type} INCIDENT</b><hr>`;

    if (data.type === 'fire') {
        // ... (Keep your existing Fire Dropdowns here) ...
        const classifications = ["For Verification", "False Alarm", "Rubbish Fire", "Post Fire", "Vehicle fire", "Grass fire", "Residential", "Commercial",];
        content += `<label style="font-size:10px;">Classification:</label>
        <select id="status-${id}" class="status-select" onchange="handleStatusChange('${id}')">`;
        classifications.forEach(opt => content += `<option value="${opt}" ${data.status === opt ? 'selected' : ''}>${opt}</option>`);
        content += `</select>`;
        
        const alarms = ["Fire out upon arrival", "Fire on Progress", "1st Alarm", "2nd Alarm", "3rd Alarm", "4th Alarm", "5th Alarm", "Task Force Alpha", "Task Force Bravo", "Task Force Charlie", "Task Force Delta", "Task Force Echo", "Task Force Hotel", "Task Force India", "General Alarm", "Under Control", "Fire Out"];
        content += `<div style="margin-top:10px;"><label style="font-size:10px;">Alarm Level:</label>
        <select id="alarm-${id}" class="status-select" onchange="logAlarm('${id}')">`;
        alarms.forEach(alrm => content += `<option value="${alrm}" ${data.alarm === alrm ? 'selected' : ''}>${alrm}</option>`);
        content += `</select></div>`;
    } 
    else {
        // --- NEW MEDICAL DROPDOWN ---
        const medOptions = [
            "For Verification", 
            "Suspected Heart Attack / Cardiac Arrest", 
            "Suspected Stroke", 
            "Vehicular Accident", 
            "Drowning", 
            "Possible Suicide", 
            "Falling Incident", 
            "Fire Incident", 
            "Electrocution", 
            "Other"
        ];
        
        content += `<label style="font-size:10px;">Medical Emergency Type:</label>
        <select id="status-${id}" class="status-select" onchange="handleMedicalStatusChange('${id}')">`;
        medOptions.forEach(opt => {
            content += `<option value="${opt}" ${data.status.startsWith(opt) ? 'selected' : ''}>${opt}</option>`;
        });
        content += `</select>`;

        // Conditional Text Input for "Other"
        content += `<div id="other-input-div-${id}" style="display: ${data.status.startsWith('Other') ? 'block' : 'none'}; margin-top: 10px;">
            <input type="text" id="other-text-${id}" placeholder="Type specific emergency..." 
            style="width: 100%; padding: 5px; color: black; border: 1px solid #ccc;" oninput="updateOtherMedicalText('${id}')">
        </div>`;
    }

    content += `<br><br><button onclick="resolveIncident('${id}')" style="background:#217346; color:white; border:none; padding:8px; width:100%; cursor:pointer; font-weight:bold;">RESOLVE & SAVE</button>
        <button onclick="deleteIncident('${id}')" style="background:#ff0000; color:white; border:none; padding:8px; width:100%; margin-top:5px; cursor:pointer;">DELETE</button></div>`;

    data.marker.bindPopup(content).openPopup();
};

        window.handleStatusChange = function(id) {
            const statusVal = document.getElementById(`status-${id}`).value;
            const data = activeIncidentMarkers[id];
            if (data.status !== statusVal) {
                data.status = statusVal;
                data.timeline.push(`[${new Date().toLocaleTimeString()}] Status changed to: ${statusVal}`);
                updatePopup(id);
            }
        };
        window.handleMedicalStatusChange = function(id) {
    const statusVal = document.getElementById(`status-${id}`).value;
    const data = activeIncidentMarkers[id];
    const labelEl = document.getElementById(`label-${id}`);
    const otherDiv = document.getElementById(`other-input-div-${id}`);

    data.status = statusVal;
    
    // Show/Hide Other Input
    if (otherDiv) otherDiv.style.display = statusVal === 'Other' ? 'block' : 'none';

    if (labelEl) {
        if (statusVal === "For Verification" || statusVal === "Other") {
            labelEl.style.display = "none";
        } else {
            labelEl.innerText = statusVal.toUpperCase();
            labelEl.style.display = "inline-block";
            labelEl.style.color = "#4da3ff"; // Blue for medical
        }
    }
    
    data.timeline.push(`[${new Date().toLocaleTimeString()}] Type: ${statusVal}`);
};

window.updateOtherMedicalText = function(id) {
    const textVal = document.getElementById(`other-text-${id}`).value;
    const data = activeIncidentMarkers[id];
    const labelEl = document.getElementById(`label-${id}`);

    if (textVal.trim() !== "") {
        data.status = "Other: " + textVal;
        if (labelEl) {
            labelEl.innerText = textVal.toUpperCase();
            labelEl.style.display = "inline-block";
        }
    } else {
        if (labelEl) labelEl.style.display = "none";
    }
};

       window.logAlarm = function(id) {
    const alarmVal = document.getElementById(`alarm-${id}`).value;
    const data = activeIncidentMarkers[id];
    const labelEl = document.getElementById(`label-${id}`);

    if (data.alarm !== alarmVal) {
        // 1. Before we update, check if the CURRENT alarm is a "Real" tactical level
        // We only "remember" it if it's not 'Under Control' or 'N/A'
        const tacticalAlarms = [
            "Fire on Progress", "1st Alarm", "2nd Alarm", "3rd Alarm", 
            "4th Alarm", "5th Alarm", "Task Force Alpha", "Task Force Bravo", 
            "Task Force Charlie", "Task Force Delta", "Task Force Echo", 
            "Task Force Hotel", "Task Force India", "General Alarm"
        ];

        // Store the last "Real" alarm in a temporary variable for the label
        if (tacticalAlarms.includes(data.alarm)) {
            data.lastTacticalLevel = data.alarm; 
        }

        // 2. Update the actual data and timeline
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        data.alarm = alarmVal;
        data.timeline.push(`${currentTime} - ${alarmVal}`);
        
        if (labelEl) {
            if (alarmVal === "Fire Out") {
                // Use the 'lastTacticalLevel' we saved, skipping 'Under Control'
                const finalDisplayAlarm = data.lastTacticalLevel || "Verified";
                labelEl.innerText = `FIRE OUT (${finalDisplayAlarm})`;
                
                // Style the Green Block
                labelEl.style.display = "inline-block";
               

                setTimeout(() => { resolveIncident(id); }, 500);

            } else if (tacticalAlarms.includes(alarmVal)) {
                // Display normal tactical alarms
                labelEl.innerText = alarmVal;
                labelEl.style.display = "inline-block";
                
            } else {
                // Hide label for "Under Control", "N/A", etc.
                labelEl.style.display = "none";
            }
        }
    }
};

        window.resolveIncident = function(id) {
    const data = activeIncidentMarkers[id];
    if (data.isResolved) return;
    
    const endTime = new Date();
    const diffMs = endTime - data.startTime;
    const durationStr = `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;

    // JOIN THE TIMELINE ARRAY INTO A SINGLE STRING
    // This creates the "9:45 AM - 10:00 AM" effect in your Excel cell
    const fullTimeline = data.timeline.join(" \n ");

    // Save to EOD Log
    const reportEntry = {
        "Incident ID": id,
        "Initial Type": data.type.toUpperCase(),
        "Barangay": data.address,
        "Reported": data.startTime.toLocaleTimeString(),
        "Resolved": endTime.toLocaleTimeString(),
        "Duration": durationStr,
        "Classification": data.status,
        "Final Alarm": data.alarm,
        "Progression Timeline": fullTimeline
    };

    dailyReportLog.push(reportEntry);
    
    // UI Updates
    if(data.type === 'fire') incidentCounts.fire--; else incidentCounts.med--;
    data.isResolved = true;
    
    const iconInner = document.getElementById(`icon-inner-${id}`);
    if (iconInner) iconInner.style.filter = "grayscale(100%) opacity(0.6)";

    map.closePopup();
    updateGlobalStats();
};window.resolveIncident = function(id) {
    const data = activeIncidentMarkers[id];
    if (!data || data.isResolved) return; 
    
    const endTime = new Date();
    const diffMs = endTime - data.startTime;
    const durationStr = `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;

    const fullTimeline = data.timeline.join(" \n ");

    // Save to EOD Log
    const reportEntry = {
        "Incident ID": id,
        "Initial Type": data.type.toUpperCase() === "FIRE" ? "FIRE" : "MED",
        // This is the specific line that ensures Street + Barangay are saved
        "Specific Location": data.address || "Unknown Location", 
        "Reported": data.startTime.toLocaleTimeString(),
        "Resolved": endTime.toLocaleTimeString(),
        "Duration": durationStr,
        "Classification": data.status,
        "Final Alarm": data.alarm || "N/A",
        "Progression Timeline": fullTimeline
    };

    dailyReportLog.push(reportEntry);
    
    // UI Updates
    if(data.type === 'fire') incidentCounts.fire--; else incidentCounts.med--;
    data.isResolved = true;
    
    const iconInner = document.getElementById(`icon-inner-${id}`);
    if (iconInner) iconInner.style.filter = "grayscale(100%) opacity(0.6)";

    map.closePopup();
    updateGlobalStats();
    
    console.log(`Incident resolved at: ${data.address}`);
};

      window.exportToExcel = function() {
    if (dailyReportLog.length === 0) return alert("No reports to export.");
    
    const wb = XLSX.utils.book_new();

    // 1. FIRE REPORTS
    const fireData = dailyReportLog.filter(item => item["Initial Type"] === "FIRE").map(item => {
    return {
        "Incident ID": item["Incident ID"],
        "Initial Type": item["Initial Type"],
        "Barangay": item["Specific Location"] || item["Barangay"], // Displays the specific street + brgy
        "Reported": item["Reported"],
        "Resolved": item["Resolved"],
        "Duration": item["Duration"],
        "Classification": item["Classification"],
        "Final Alarm": item["Final Alarm"] || item["Alarm Level"] || "N/A",
        "Progression Timeline": item["Progression Timeline"]
    };
});

    // 2. MEDICAL REPORTS
    const medData = dailyReportLog.filter(item => item["Initial Type"] === "MED").map(item => {
        return {
            "Incident ID": item["Incident ID"],
            "Initial Type": item["Initial Type"],
            "Specific Location": item["Specific Location"], // Street and Brgy
            "Medical Emergency Type": item["Classification"],
            "Reported": item["Reported"],
            "Resolved": item["Resolved"],
            "Duration": item["Duration"]
        };
    });

    // ... (rest of your sheet creation logic stays the same)
    if (fireData.length > 0) {
        const wsFire = XLSX.utils.json_to_sheet(fireData);
        XLSX.utils.book_append_sheet(wb, wsFire, "Fire Incidents");
    }
    
    if (medData.length > 0) {
        const wsMed = XLSX.utils.json_to_sheet(medData);
        XLSX.utils.book_append_sheet(wb, wsMed, "Medical Incidents");
    }

    XLSX.writeFile(wb, `TULONG_Report_${new Date().toLocaleDateString()}.xlsx`);
};

        window.wipeMapAndExport = function() {
            if (confirm("⚠️ ARE YOU SURE TO WIPE MAP?")) {
                exportToExcel();
                for (let id in activeIncidentMarkers) map.removeLayer(activeIncidentMarkers[id].marker);
                activeIncidentMarkers = {};
                dailyReportLog = [];
                incidentCounts = { fire: 0, med: 0 };
                updateGlobalStats();
            }
        };

        function updateGlobalStats() {
            document.getElementById('total-incidents').innerText = incidentCounts.fire + incidentCounts.med;
            infoCounter.update();
        }

        // STATIONS DATA
        const x0 = [
             { id: "ceb-1", name: "Bureau of Fire Protection - Regional Office VII", number: "(032) 517 9027", lat: 10.2979789, lng: 123.8922118, type: "bfp" },
             { id: "ceb-2", name: "Cebu City Fire Station (Pari-an)", number: "(032) 255 0785", lat: 10.2993222, lng: 123.9034484, type: "bfp" },
             { id: "ceb-3", name: "Labangon Fire Station", number: "(032) 261 0911", lat: 10.2991806, lng: 123.8810782, type: "bfp" },
             { id: "ceb-4", name: "Guadalupe Fire Sub-Station", number: "+63 947 523 6144", lat: 10.3225746, lng: 123.8840113, type: "bfp" },
             { id: "ceb-5", name: "Lahug Fire Sub-Station", number: "(032) 256 0541", lat: 10.3243147, lng: 123.8985383, type: "bfp" },
             { id: "ceb-6", name: "Apas Fire Sub-Station", number: "(032) 416 5103", lat: 10.3371357, lng: 123.9048811, type: "bfp" },
             { id: "ceb-7", name: "Mabolo Fire Sub-Station", number: null, lat: 10.3122927, lng: 123.9159289, type: "bfp" },
             { id: "ceb-8", name: "Cebu Business Park Fire Sub-Station", number: "0917 505 1100", lat: 10.3138334, lng: 123.9083305, type: "bfp" },
             { id: "ceb-9", name: "BFP R7 Mandaue City Fire Station", number: "(032) 344 4747", lat: 10.3230721, lng: 123.9412341, type: "bfp" },
             { id: "llc-1", name: "BFP Gun-Ob (Main/COMMEL)", number: "(032) 340-0252 / 0956-501-0897", lat: 10.3019, lng: 123.9512, type: "bfp" },
             { id: "llc-2", name: "Lapu-Lapu City Fire Station 1", number: "0999 972 1111", lat: 10.30525, lng: 123.958844, type: "bfp" },
             { id: "llc-3", name: "Poblacion Sub-Station (Stn 2)", number: "(032) 326-4638 / 0909-408-3068", lat: 10.313143, lng: 123.948846, type: "bfp" },
             { id: "llc-4", name: "Babag Sub-Station (Stn 3)", number: "(032) 410-8229 / 0981-262-5090", lat: 10.28666, lng: 123.944331, type: "bfp" },
             { id: "llc-5", name: "Marigondon Sub-Station (Stn 4)", number: "(032) 328-0917 / 0967-991-1356", lat: 10.27591, lng: 123.975443, type: "bfp" },
             { id: "llc-6", name: "Mactan Sub-Station (Stn 5)", number: "(032) 342-8508 / 0981-740-5865", lat: 10.309056, lng: 124.01114, type: "bfp" },
             { id: "llc-7", name: "Olango Island Fire Station (Stn 6)", number: "0923-815-7696 / (032) 511 5171", lat: 10.271054, lng: 124.060161, type: "bfp" },
             { id: "ceb-22", name: "TINAGO Fire Brigade", number: null, lat: 10.297175400366998, lng: 123.90882481339237, type: "volunteer" },
             { id: "ceb-22", name: "LAHUG Fire Brigade", number: null, lat: 10.324467490309958, lng: 123.89855545767162, type: "volunteer" },
             { id: "ceb-11", name: "Cebu Filipino-Chinese Volunteer Fire Brigade", number: "(032) 254 0200", lat: 10.310547, lng: 123.8891627, type: "volunteer" },
             { id: "ceb-12", name: "NARF Rescue and Fire Brigade", number: null, lat: 10.3159419, lng: 123.8959584, type: "volunteer" },
             { id: "ceb-13", name: "Cebu Chamber Volunteer Fire Brigade", number: "(032) 254 0200", lat: 10.3009152, lng: 123.9012345, type: "volunteer" },
             { id: "ceb-14", name: "Emergency Rescue Unit Foundation Fire Brigade", number: "0918 921 0000", lat: 10.2964812, lng: 123.9029182, type: "volunteer" },
             { id: "llc-V1", name: "ERUF Lapu-Lapu", number: "(032) 340-2994 / 161", lat: 10.317454, lng: 123.963162, type: "volunteer" },
             { id: "ceb-014", name: "Naga City Fire Station", number: "(032) 272 6410", lat: 10.2080, lng: 123.7580, type: "bfp" },
             { id: "ceb-012", name: "Talisay City Fire Station", number: "(032) 272 8277", lat: 10.2450, lng: 123.8490, type: "bfp" },
             { id: "ceb-013", name: "Minglanilla Fire Station", number: "(032) 273 2830", lat: 10.2440, lng: 123.7960, type: "bfp" },
             { id: "ceb-015", name: "Liloan Fire Station", number: "(032) 564 3781", lat: 10.3990, lng: 123.9990, type: "bfp" },
             { id: "ceb-016", name: "Argao Fire Station", number: "(032) 367 7680", lat: 9.8790, lng: 123.5950, type: "bfp" },
             { id: "ceb-017", name: "Bogo City Fire Station", number: "(032) 434 8575", lat: 11.0506, lng: 124.0048, type: "bfp" },
             { id: "ceb-018", name: "Danao City Fire Station", number: "(032) 200 4000", lat: 10.5233, lng: 124.0300, type: "bfp" },
             { id: "ceb-019", name: "Toledo City Fire Station", number: "(032) 322 5755", lat: 10.3789, lng: 123.6386, type: "bfp" },
             { id: "ceb-20", name: "Argao Fire Station", number: "(032) 367 7680", lat: 9.8790, lng: 123.5950, type: "bfp" },
             { id: "ceb-21", name: "Consolacion Fire Station", number: "(032) 423 3037", lat: 10.3794, lng: 123.9535, type: "bfp" }
        ];

        
        
        const stationContainer = document.getElementById('station-container');
        document.getElementById('station-count').innerText = x0.length;

        x0.forEach(station => {
            const icon = station.type === "bfp" ? fireIcon : volunteerIcon;
            L.marker([station.lat, station.lng], { icon }).addTo(map).bindPopup(`<b>${station.name}</b><br>📞 ${station.number || "N/A"}`);
            const div = document.createElement('div');
            div.className = 'station-item';
            div.innerHTML = `<div><b>${station.type.toUpperCase()}</b>: ${station.name}</div>`;
            div.onclick = () => map.flyTo([station.lat, station.lng], 16);
            stationContainer.appendChild(div);
        });

    

        // LOGOUT BUTTON HANDLER
        document.getElementById('logout-trigger').addEventListener('click', function() {
            if (confirm("CONFIRM SYSTEM LOGOUT?\n PLEASE DOWNLOAD EOD REPORT")) {
                window.firebaseSignOut().then(() => {
                    window.location.href = 'index.html';
                }).catch(err => console.error(err));
            }
            
        });

        setTimeout(() => { map.invalidateSize(); }, 500);
    
