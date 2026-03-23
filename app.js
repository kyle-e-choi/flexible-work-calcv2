// 2026년 한국 공휴일 데이터
const HOLIDAYS_2026 = [
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-03-01", "2026-03-02",
    "2026-05-05", "2026-05-24", "2026-05-25", "2026-06-06", "2026-08-15", "2026-08-17",
    "2026-09-24", "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05", "2026-10-09", "2026-12-25"
];

let state = {
    startDate: '',
    endDate: '',
    entries: [],
};

let deleteTargetId = null;
let scannedEntries = [];

// --- UI Helper Functions ---
function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

// --- Data Management Functions ---

function exportData() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flex-work-data-${getLocalDateString(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (confirm('기존 데이터를 덮어쓰고 새로 가져오시겠습니까?')) {
                state = { ...state, ...imported };
                saveToLocalStorage();
                renderAll();
                alert('데이터를 성공적으로 가져왔습니다!');
            }
        } catch (err) {
            alert('유효하지 않은 파일 형식입니다.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset for next use
}



// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initEventListeners();
    initTabs();
    renderAll();
});

function initEventListeners() {
    document.getElementById('setPeriodBtn').addEventListener('click', () => {
        const s = document.getElementById('startDate').value;
        const e = document.getElementById('endDate').value;
        if (!s || !e) return alert('날짜를 입력하세요.');
        state.startDate = s;
        state.endDate = e;
        saveToLocalStorage();
        renderAll();
    });

    const modal = document.getElementById('entryModal');
    document.getElementById('addEntryBtn').addEventListener('click', () => {
        document.getElementById('entryForm').reset();
        document.getElementById('editEntryId').value = '';
        document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('modalTitle').innerText = '근무 기록 추가';
        toggleTimeInputs('work');
        showModal('entryModal');
    });

    document.getElementById('entryType').addEventListener('change', (e) => toggleTimeInputs(e.target.value));
    document.getElementById('cancelBtn').addEventListener('click', () => hideModal('entryModal'));

    // Delete Confirmation Event Listeners
    document.getElementById('confirmCancelBtn').addEventListener('click', () => {
        hideModal('confirmModal');
        deleteTargetId = null;
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        if (deleteTargetId !== null) {
            state.entries = state.entries.filter(e => e.id !== deleteTargetId);
            saveToLocalStorage();
            renderAll();
            hideModal('confirmModal');
            deleteTargetId = null;
        }
    });

    // Data Management
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importData);

    // AI Scan Event Listeners
    document.getElementById('aiScanBtn').addEventListener('click', () => showModal('aiScanModal'));
    
    const scanTabs = document.querySelectorAll('.scan-tab');
    scanTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            scanTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const mode = tab.dataset.mode;
            document.getElementById('textScanArea').style.display = mode === 'text' ? 'block' : 'none';
            document.getElementById('imageScanArea').style.display = mode === 'image' ? 'block' : 'none';
        });
    });

    document.getElementById('parseTextBtn').addEventListener('click', handleTextScan);
    document.getElementById('saveScannedBtn').addEventListener('click', saveScannedData);
    
    // [FIX] dropZone 클릭 시 파일 선택창 열기
    const dropZone = document.getElementById('dropZone');
    const imageInput = document.getElementById('imageInput');
    if (dropZone && imageInput) {
        dropZone.addEventListener('click', () => imageInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        });
        
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');
            if (e.dataTransfer.files.length > 0) {
                processImageFile(e.dataTransfer.files[0]);
            }
        });
    }
    
    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processImageFile(e.target.files[0]);
        }
    });

    // AI Chatbot
    document.getElementById('aiChatBtn').addEventListener('click', toggleChat);

    document.getElementById('entryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editEntryId').value;
        const date = document.getElementById('entryDate').value;
        const type = document.getElementById('entryType').value;
        let seconds = 0;
        let startTime = "";
        let endTime = "";

        if (type === 'work' || type === 'holiday') {
            startTime = document.getElementById('startTime').value;
            endTime = document.getElementById('endTime').value;
            if (startTime && endTime) {
                seconds = calculateWorkDuration(startTime, endTime);
            } else {
                seconds = parseHHMMSSToSeconds(document.getElementById('entryTime').value);
            }
        } else if (type === 'annual') {
            seconds = 8 * 3600;
        } else {
            seconds = 4 * 3600;
        }

        const entryData = { 
            id: id ? parseInt(id) : Date.now(), 
            date, 
            type, 
            seconds,
            startTime,
            endTime 
        };

        if (id) {
            const idx = state.entries.findIndex(e => e.id === parseInt(id));
            state.entries[idx] = entryData;
        } else {
            state.entries.push(entryData);
        }

        state.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveToLocalStorage();
        hideModal('entryModal');
        renderAll();
    });
}

function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            btns.forEach(b => b.classList.toggle('active', b === btn));
            contents.forEach(c => c.classList.toggle('active', c.id === `${tab}Tab`));
            if (tab === 'calendar') renderCalendar();
        });
    });
}

function toggleTimeInputs(type) {
    const row = document.querySelector('.input-group-row');
    const manual = document.getElementById('manualTimeGroup');
    if (type === 'annual' || type.startsWith('half')) {
        row.style.display = 'none';
        manual.style.display = 'none';
    } else {
        row.style.display = 'flex';
        manual.style.display = 'block';
    }
}

function calculateWorkDuration(start, end) {
    const s = parseHHMMSSToSeconds(start + (start.split(':').length === 2 ? ':00' : ''));
    const e = parseHHMMSSToSeconds(end + (end.split(':').length === 2 ? ':00' : ''));
    let diff = e - s;
    if (diff < 0) diff += 24 * 3600;

    // 점심시간 (12:00 ~ 13:00) 오버랩 계산
    const lunchStart = 12 * 3600;
    const lunchEnd = 13 * 3600;
    
    // 출근시간과 퇴근시간이 점심시간과 겹치는 구간 계산
    const overlapStart = Math.max(s, lunchStart);
    const overlapEnd = Math.min(e, lunchEnd);
    const lunchOverlap = Math.max(0, overlapEnd - overlapStart);
    
    // 법정 최소 휴게시간 (4시간당 30분) 보전
    // 점심시간 공제가 법정 최소치보다 작을 경우 최소치를 적용함
    let deduction = lunchOverlap;
    if (diff > 8 * 3600 && deduction < 3600) deduction = 3600;
    else if (diff > 4 * 3600 && deduction < 1800) deduction = 1800;
    
    return Math.max(0, diff - deduction);
}

function parseHHMMSSToSeconds(str) {
    if (!str) return 0;
    const p = str.split(':').map(Number);
    return (p[0] * 3600) + (p[1] * 60) + (p[2] || 0);
}

function formatSecondsToHHMMSS(s) {
    const neg = s < 0;
    const a = Math.abs(s);
    const h = Math.floor(a / 3600);
    const m = Math.floor((a % 3600) / 60);
    const sc = Math.floor(a % 60);
    const f = (n) => n.toString().padStart(2, '0');
    return `${neg ? '-' : ''}${f(h)}:${f(m)}:${f(sc)}`;
}

function getLocalDateString(d) {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function getWorkingDays(start, end) {
    let count = 0;
    // 날짜 객체 복사본 사용 및 루프 안정화
    const current = new Date(start);
    current.setHours(0,0,0,0);
    const targetEnd = new Date(end);
    targetEnd.setHours(0,0,0,0);

    while (current <= targetEnd) {
        const ds = getLocalDateString(current);
        const day = current.getDay();
        // 주말(0:일, 6:토) 및 공휴일 제외
        if (day !== 0 && day !== 6 && !HOLIDAYS_2026.includes(ds)) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function renderAll() {
    renderDashboard();
    renderAnnualLeave();
    updateAIRecommendation();
}

function renderDashboard() {
    if (!state.startDate || !state.endDate) return;
    const stats = calculateStats();
    
    document.getElementById('totalWorkHours').innerText = formatSecondsToHHMMSS(stats.workedSeconds);
    document.getElementById('targetWorkHours').innerText = formatSecondsToHHMMSS(stats.targetSeconds);
    document.getElementById('remainingWorkHours').innerText = formatSecondsToHHMMSS(stats.diffFromElapsed);
    document.getElementById('totalHolidayHours').innerText = formatSecondsToHHMMSS(stats.holidaySeconds);
    document.getElementById('daysInPeriod').innerText = `실근무 ${stats.totalWorkingDays}일 기준`;
    document.getElementById('workProgress').style.width = `${stats.progress}%`;

    const statusCard = document.getElementById('remainingWorkCard');
    const statusText = document.getElementById('workStatusText');
    statusCard.classList.remove('danger', 'success', 'info');
    
    if (stats.diffFromElapsed < 0) {
        statusCard.classList.add('danger');
        statusText.innerText = `현재 시점 대비 ${formatSecondsToHHMMSS(Math.abs(stats.diffFromElapsed))} 부족`;
    } else {
        statusCard.classList.add(stats.diffFromElapsed < 3600 ? 'success' : 'info');
        const prefix = stats.diffFromElapsed < 3600 ? '정상 궤도' : '초과 근무';
        statusText.innerText = `${prefix} (${formatSecondsToHHMMSS(stats.diffFromElapsed)} 여유)`;
    }

    const list = document.getElementById('entryList');
    list.innerHTML = '';
    state.entries.forEach(e => {
        const tr = document.createElement('tr');
        const detail = e.startTime ? `${e.startTime} ~ ${e.endTime}` : '-';
        tr.innerHTML = `
            <td>${e.date}</td>
            <td>${getLabel(e.type)}</td>
            <td>${formatSecondsToHHMMSS(e.seconds)}</td>
            <td>${detail}</td>
            <td>
                <button onclick="editEntry(${e.id})" class="text-btn" style="color:#00d2ff">수정</button>
                <button onclick="deleteEntry(${e.id})" class="text-btn" style="color:#ff4d4d">삭제</button>
            </td>
        `;
        list.appendChild(tr);
    });
}

function calculateStats() {
    const start = new Date(state.startDate);
    const end = new Date(state.endDate);
    const totalWorkingDays = getWorkingDays(new Date(start), new Date(end));
    const targetSeconds = totalWorkingDays * 8 * 3600;

    const today = new Date(); today.setHours(0,0,0,0);
    const effectiveToday = today > end ? end : (today < start ? start : today);
    const elapsedWorkingDays = getWorkingDays(new Date(start), effectiveToday);
    const elapsedTargetSeconds = elapsedWorkingDays * 8 * 3600;

    let workedSeconds = 0;
    let holidaySeconds = 0;
    let isLive = false; // Flag for live tracking

    state.entries.forEach(entry => {
        let entrySeconds = 0;
        const todayStr = getLocalDateString(new Date());

        // --- Live Work Detection ---
        // If it's today and has startTime but no endTime, use current time for live duration
        if (entry.date === todayStr && entry.type === 'work' && entry.startTime && !entry.endTime) {
            const now = new Date();
            const startDateTime = new Date(`${entry.date}T${entry.startTime}`);
            entrySeconds = Math.max(0, (now - startDateTime) / 1000);
            
            // Deduct lunch if already passed 12:00
            const lunchStart = new Date(`${entry.date}T12:00:00`);
            const lunchEnd = new Date(`${entry.date}T13:00:00`);
            if (now > lunchStart) {
                const overlapStart = Math.max(startDateTime.getTime(), lunchStart.getTime());
                const overlapEnd = Math.min(now.getTime(), lunchEnd.getTime());
                const lunchOverlap = Math.max(0, overlapEnd - overlapStart);
                if (lunchOverlap > 0) entrySeconds -= (lunchOverlap / 1000);
            }
            isLive = true;
        } else {
            entrySeconds = entry.seconds; // Use stored seconds for completed entries
        }

        if (['work', 'annual', 'halfMorning', 'halfAfternoon'].includes(entry.type)) {
            workedSeconds += entrySeconds;
        } else {
            holidaySeconds += entrySeconds;
        }
    });

    return { 
        totalWorkingDays, targetSeconds, workedSeconds, holidaySeconds, 
        diffFromElapsed: workedSeconds - elapsedTargetSeconds,
        progress: Math.min(100, (workedSeconds / targetSeconds) * 100),
        isLive: isLive
    };
}

function renderAnnualLeave() {
    const list = document.getElementById('annualLeaveList');
    list.innerHTML = '';
    let total = 0;
    state.entries.filter(e => e.type === 'annual' || e.type.startsWith('half')).forEach(e => {
        const count = e.type === 'annual' ? 1 : 0.5;
        total += count;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${e.date}</td><td>${getLabel(e.type)}</td><td>${count}개</td>`;
        list.appendChild(tr);
    });
    document.getElementById('totalAnnualCount').innerText = `${total.toFixed(1)}개`;
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    
    for (let m = 0; m < 12; m++) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'month-view glass';
        monthDiv.innerHTML = `<div class="month-name">${months[m]}</div>`;
        
        const daysGrid = document.createElement('div');
        daysGrid.className = 'days-grid';
        ["일", "월", "화", "수", "목", "금", "토"].forEach(d => {
            daysGrid.innerHTML += `<div class="day-header">${d}</div>`;
        });

        const firstDay = new Date(2026, m, 1).getDay();
        const lastDate = new Date(2026, m + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) daysGrid.innerHTML += `<div></div>`;
        
        for (let d = 1; d <= lastDate; d++) {
            const dateStr = `2026-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            const isHoliday = HOLIDAYS_2026.includes(dateStr) || new Date(2026, m, d).getDay() === 0;
            const entries = state.entries.filter(e => e.date === dateStr);
            const hasWork = entries.some(e => e.type === 'work');
            const hasLeave = entries.some(e => e.type === 'annual' || e.type.startsWith('half'));
            
            const classes = ['day-cell'];
            if (isHoliday) classes.push('holiday');
            if (hasWork) classes.push('has-work');
            if (hasLeave) classes.push('has-leave');
            
            daysGrid.innerHTML += `<div class="${classes.join(' ')}">${d}</div>`;
        }
        monthDiv.appendChild(daysGrid);
        grid.appendChild(monthDiv);
    }
}

function editEntry(id) {
    const entry = state.entries.find(e => e.id === id);
    if (!entry) return;
    
    const modal = document.getElementById('entryModal');
    document.getElementById('editEntryId').value = entry.id;
    document.getElementById('entryDate').value = entry.date;
    document.getElementById('entryType').value = entry.type;
    document.getElementById('modalTitle').innerText = '근무 기록 수정';
    
    toggleTimeInputs(entry.type);
    if (entry.startTime) {
        document.getElementById('startTime').value = entry.startTime;
        document.getElementById('endTime').value = entry.endTime;
    } else {
        document.getElementById('entryTime').value = formatSecondsToHHMMSS(entry.seconds);
    }
    
    modal.style.display = 'flex';
    showModal('entryModal');
}

function getLabel(t) {
    return {work:'정상 근무', holiday:'휴일 근무', annual:'연차', halfMorning:'오전 반차', halfAfternoon:'오후 반차'}[t] || t;
}

function deleteEntry(id) {
    deleteTargetId = id;
    showModal('confirmModal');
}

// --- AI Advanced Logic (Version 3) ---

function getRecommendationData() {
    if (!state.startDate || !state.endDate) return null;

    const stats = calculateStats();
    const today = new Date();
    today.setHours(0,0,0,0);
    const end = new Date(state.endDate);
    
    const remainingWorkingDays = getWorkingDays(today > new Date(state.startDate) ? today : new Date(state.startDate), end);
    if (remainingWorkingDays <= 0) return null;

    const remainingSeconds = stats.targetSeconds - stats.workedSeconds;
    const avgSecondsPerDay = remainingSeconds / remainingWorkingDays;
    
    const todayEntry = state.entries.find(e => e.date === getLocalDateString(new Date()));
    const baseStartTime = todayEntry?.startTime || "09:00:00";
    const [h, m, s] = baseStartTime.split(':').map(Number);
    
    const totalDuration = avgSecondsPerDay + 3600; // 점심 1시간 포함
    const exitDate = new Date();
    exitDate.setHours(h, m, s || 0);
    exitDate.setSeconds(exitDate.getSeconds() + totalDuration);
    
    const recExitTime = exitDate.toTimeString().substring(0, 5);
    const isCoreViolation = exitDate.getHours() < 16;
    const finalExit = isCoreViolation ? "16:00" : recExitTime;

    return {
        avgSecondsPerDay,
        baseStartTime,
        finalExit,
        isCoreViolation,
        isLive: stats.isLive,
        remainingSeconds
    };
}

function updateAIRecommendation() {
    const insightEl = document.getElementById('aiInsight');
    const insightText = document.getElementById('aiInsightText');
    if (!insightEl || !insightText) return;

    const data = getRecommendationData();
    if (!data) {
        insightEl.style.display = 'none';
        return;
    }

    let recText = "";
    if (data.remainingSeconds <= 0) {
        recText = "축하합니다! 이번 기간의 목표를 달성하셨습니다. 🎉";
    } else {
        const liveBadge = data.isLive ? "<span style='color:#00ff88; font-weight:bold;'>[LIVE]</span> " : "";
        recText = `${liveBadge}평균 **${formatSecondsToHHMMSS(data.avgSecondsPerDay).substring(0,5)}** 근무 필요. 오늘 ${data.baseStartTime.substring(0,5)} 출근 시 **${data.finalExit}** 퇴근 추천!`;
    }

    insightText.innerHTML = recText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    insightEl.style.display = 'flex';
}

let geminiApiKey = localStorage.getItem('gemini_api_key') || "";

function toggleApiSettings() {
    const panel = document.getElementById('apiSettingsPanel');
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
    if (panel.style.display === 'flex') {
        document.getElementById('apiKeyInput').value = geminiApiKey;
        document.getElementById('apiErrorMsg').style.display = 'none';
        if (geminiApiKey) {
            document.getElementById('modelSelectionArea').style.display = 'block';
            fetchAndPopulateModels(geminiApiKey);
        }
    }
}

async function useOllama() {
    let endpoint = prompt("Ollama 서버 주소를 입력하세요 (기본값: http://localhost:11434)", "http://localhost:11434");
    if (!endpoint) return;
    
    endpoint = endpoint.replace(/\/$/, "");
    if (!endpoint.startsWith('http')) endpoint = 'http://' + endpoint;

    localStorage.setItem('ollama_endpoint', endpoint);
    localStorage.setItem('ai_mode', 'ollama');
    updateApiStatus();
    fetchOllamaModels();
    appendMessage('bot', `🦙 Ollama 모드로 전환되었습니다. 로컬 모델 동기화를 시도합니다.`);
}

async function fetchOllamaModels() {
    const baseEndpoint = localStorage.getItem('ollama_endpoint') || "http://localhost:11434";
    const tagsUrl = baseEndpoint + "/api/tags";
    const select = document.getElementById('ollamaModelSelect');
    const area = document.getElementById('ollamaModelArea');
    
    if (!select || !area) return;
    area.style.display = 'block';
    select.innerHTML = "<option>불러오는 중...</option>";

    try {
        const res = await fetch(tagsUrl);
        if (!res.ok) throw new Error("모델 목록 요청 실패");
        const data = await res.json();
        
        if (data.models && data.models.length > 0) {
            select.innerHTML = data.models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
            const saved = localStorage.getItem('ollama_model');
            if (saved) select.value = saved;
            else saveOllamaModel(data.models[0].name);
        } else {
            select.innerHTML = "<option value=''>설치된 모델이 없습니다.</option>";
        }
    } catch (err) {
        console.error("Tags fetch error:", err);
        select.innerHTML = "<option value=''>연결 실패 (CORS 확인)</option>";
    }
}

function saveOllamaModel(val) {
    if (!val) return;
    localStorage.setItem('ollama_model', val);
    appendMessage('bot', `🦙 사용 모델이 [${val}]루(으로) 설정되었습니다.`);
}

async function testOllamaConnection() {
    console.log("Testing Ollama connection...");
    const logs = document.getElementById('ollamaTestLogs');
    const baseEndpoint = localStorage.getItem('ollama_endpoint') || "http://localhost:11434";
    const fullEndpoint = baseEndpoint + "/api/generate";
    const model = localStorage.getItem('ollama_model') || "llama3";
    
    if (!logs) return;
    logs.style.display = 'block';
    logs.style.color = '#00ff88';
    logs.innerText = "⏳ 연결 시도 중...";

    try {
        const res = await fetch(fullEndpoint, {
            method: 'POST',
            body: JSON.stringify({ model: model, prompt: "hi", stream: false }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (res.ok) {
            logs.innerText = `✅ 연결 성공! (${model} 모델 응답 확인)`;
        } else {
            const raw = await res.text();
            throw new Error(`HTTP ${res.status}: ${raw.substring(0, 50)}`);
        }
    } catch (err) {
        logs.style.color = '#ff4d4d';
        console.error("Scale error:", err);
        logs.innerText = `❌ 오류: ${err.message}`;
    }
}

// [MODIFIED] 초기화 시 API 상태 업데이트 호출 추가
window.addEventListener('DOMContentLoaded', () => {
    updateApiStatus();
});

async function fetchAndPopulateModels(key) {
    const modelArea = document.getElementById('modelSelectionArea');
    const select = document.getElementById('modelSelect');
    if (!modelArea || !select) return;

    try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await listRes.json();
        
        if (!listRes.ok || !data.models) {
            console.error("Gemini ListModels failed:", data);
            select.innerHTML = "<option value=''>모델 목록을 불러올 수 없습니다.</option>";
            return;
        }

        // 필터 조건 완화: 'gemini' 이름 포함 또는 'generateContent' 메서드 지원
        const models = data.models.filter(m => 
            (m.supportedMethods?.some(meth => meth.toLowerCase().includes('generatecontent'))) ||
            (m.name.toLowerCase().includes('gemini') && !m.name.includes('vision') && !m.name.includes('embedding'))
        );

        console.log("Found models:", models);

        if (models.length === 0) {
            select.innerHTML = "<option value=''>사용 가능한 모델이 없습니다. (API 응답 확인 필요)</option>";
            return;
        }

        select.innerHTML = "";
        
        const currentUrl = localStorage.getItem('gemini_api_url') || "";
        const currentModelId = currentUrl.split('/').pop();

        models.forEach(m => {
            const id = m.name.split('/').pop();
            const opt = document.createElement('option');
            opt.value = id;
            opt.innerText = id;
            if (id === currentModelId) opt.selected = true;
            select.appendChild(opt);
        });

        modelArea.style.display = 'block';
        
        // 모델 변경 이벤트 리스너 (이미 있으면 제거 후 다시 추가)
        select.onchange = (e) => {
            const newId = e.target.value;
            localStorage.setItem('gemini_api_url', `https://generativelanguage.googleapis.com/v1beta/models/${newId}`);
            appendMessage('bot', `✨ 모델이 ${newId}로 변경되었습니다.`);
        };
    } catch (e) {
        console.error("Model fetch error:", e);
    }
}

async function saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    const errorEl = document.getElementById('apiErrorMsg');
    const key = input.value.trim();
    
    errorEl.style.display = 'none';
    if (!key) {
        errorEl.innerText = "API 키를 입력해주세요.";
        errorEl.style.display = 'block';
        return;
    }

    const saveBtn = document.querySelector('.save-btn');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "모델 조회 중...";
    saveBtn.disabled = true;

    try {
        // 1. 가용 모델 목록 조회 및 드롭다운 활성화
        await fetchAndPopulateModels(key);
        
        const select = document.getElementById('modelSelect');
        if (select.options.length === 0) throw new Error("사용 가능한 모델을 찾을 수 없습니다.");

        // 첫 번째 또는 Flash 모델을 기본값으로 자동 설정
        const flashModel = Array.from(select.options).find(o => o.value.includes('flash')) || select.options[0];
        const modelId = flashModel.value;
        flashModel.selected = true;

        // 성공 시 저장
        geminiApiKey = key;
        localStorage.setItem('gemini_api_key', key);
        localStorage.setItem('gemini_api_url', `https://generativelanguage.googleapis.com/v1beta/models/${modelId}`);
        
        updateApiStatus();
        appendMessage('bot', `✨ API 키가 저장되고 ${modelId} 모델이 연결되었습니다.`);
    } catch (err) {
        errorEl.innerText = `연결 실패: ${err.message}`;
        errorEl.style.display = 'block';
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
}

function updateApiStatus() {
    const status = document.getElementById('apiStatus');
    const mode = localStorage.getItem('ai_mode') || (geminiApiKey ? 'gemini' : 'rule');
    
    if (mode === 'ollama') {
        status.innerText = "Local Ollama Mode";
        status.style.color = "#ff8c00";
    } else if (mode === 'gemini') {
        status.innerText = "Gemini AI Mode";
        status.style.color = "#6e8efb";
    } else {
        status.innerText = "Rule-based Mode";
        status.style.color = "#aaa";
    }
}

function toggleChat() {
    const modal = document.getElementById('aiChatModal');
    const isVisible = modal.style.display === 'flex';
    modal.style.display = isVisible ? 'none' : 'flex';
    
    updateApiStatus();
    
    if (!isVisible) {
        setTimeout(() => document.getElementById('chatInput').focus(), 400);
    }
}

function handleQuickQuery(text) {
    const input = document.getElementById('chatInput');
    input.value = text;
    sendChat();
}

function sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    appendMessage('user', msg);
    input.value = '';
    processAIChat(msg);
}

let chatHistory = [];

async function processAIChat(msg) {
    const typing = document.getElementById('typingIndicator');
    typing.style.display = 'flex';
    
    const mode = localStorage.getItem('ai_mode') || (geminiApiKey ? 'gemini' : 'rule');

    try {
        let responseText = "";
        if (mode === 'rule') {
            responseText = generateAIResponse(msg);
        } else if (mode === 'ollama') {
            const baseEndpoint = localStorage.getItem('ollama_endpoint') || "http://localhost:11434";
            const fullEndpoint = baseEndpoint + "/api/generate";
            const model = localStorage.getItem('ollama_model') || 'llama3';
            
            // 시스템 컨텍스트 생성
            const stats = calculateStats();
            const now = new Date();
            const recentEntries = state.entries.slice(-15).map(e => 
                `[ID: ${e.id}] ${e.date} ${e.startTime || ''}~${e.endTime || ''} (${e.type})`
            ).join('\n');
            const sysPrompt = `당신은 '유연근무 계산기'의 도우미 AI입니다. 
다음 통계 정보를 참고하여 **반드시 한국어로만** 답변하세요:
- 기간: ${state.startDate} ~ ${state.endDate}
- 총 근무: ${formatSecondsToHHMMSS(stats.workedSeconds)}
- 달성률: ${stats.progress.toFixed(1)}%

데이터를 추가/수정/삭제해야 할 경우, 답변 맨 마지막 줄에 반드시 아래와 같은 형식의 JSON을 포함하세요. (여러 개 가능)
TOOL_REQUEST: { "name": "update_work_record", "args": { "id": "기록ID", "startTime": "HH:MM", "endTime": "HH:MM" } }
TOOL_REQUEST: { "name": "add_work_record", "args": { "date": "YYYY-MM-DD", "type": "work", "startTime": "HH:MM", "endTime": "HH:MM" } }
TOOL_REQUEST: { "name": "delete_work_record", "args": { "id": "기록ID" } }

ID는 최근 기록 리스트에 있는 값을 사용하세요.
${recentEntries}`;

            const res = await fetch(fullEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    model: model, 
                    system: sysPrompt,
                    prompt: msg, 
                    stream: false 
                })
            });
            
            if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
            const data = await res.json();
            responseText = data.response;

            // 정규식으로 TOOL_REQUEST 감지 및 실행
            const toolRegex = /TOOL_REQUEST:\s*(\{.*?\})/g;
            let m;
            while ((m = toolRegex.exec(responseText)) !== null) {
                try {
                    const call = JSON.parse(m[1]);
                    const result = await handleFunctionCall(call);
                    responseText += `\n\n(시스템: ${result})`;
                } catch (e) {
                    console.error("Tool execution failed:", e);
                }
            }
        } else {
            const responseData = await callGeminiAPI(msg);
            if (responseData.candidates) {
                const part = responseData.candidates[0].content.parts[0];
                if (part.functionCall) {
                    const result = await handleFunctionCall(part.functionCall);
                    const followUp = await callGeminiAPI(null, result, part.functionCall.name);
                    responseText = followUp.candidates[0].content.parts[0].text;
                } else {
                    responseText = part.text;
                }
            }
        }
        appendMessage('bot', responseText);
    } catch (err) {
        console.error('AI Error:', err);
        appendMessage('bot', `⚠️ 오류가 발생했습니다: ${err.message}. Rule-based 모드로 전환을 시도합니다.`);
    } finally {
        typing.style.display = 'none';
    }
}

async function callGeminiAPI(prompt, toolResult = null, toolName = null) {
    // 저장된 성공 URL 사용, 없으면 기본값
    const baseUrl = localStorage.getItem('gemini_api_url') || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001";
    const url = `${baseUrl}:generateContent?key=${geminiApiKey}`;
    
    // 시스템 정보 주입 (현재 상태)
    const stats = calculateStats();
    const now = new Date();
    const recentEntries = state.entries.slice(-15).map(e => 
        `[ID: ${e.id}] ${e.date} ${e.startTime}~${e.endTime} (${e.type})`
    ).join('\n');

    // [ADD] 요일별 요약 데이터를 미리 시스템 정보에 포함시켜 도구 호출(Quota 소모) 방지
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayStats = {};
    state.entries.forEach(e => {
        const d = new Date(e.date);
        const day = days[d.getDay()];
        dayStats[day] = (dayStats[day] || 0) + (e.seconds / 3600);
    });
    const summaryByDay = Object.entries(dayStats).map(([d, h]) => `${d}: ${h.toFixed(1)}시간`).join(', ');

    const systemContext = `현재 사용자 시간: ${now.toLocaleString('ko-KR')} (반드시 한국어로 답변하세요)
    현재 데이터 요약: 
    - 정산 기간: ${state.startDate} ~ ${state.endDate}
    - 총 근무: ${formatSecondsToHHMMSS(stats.workedSeconds)}
    - 목표: ${formatSecondsToHHMMSS(stats.targetSeconds)}
    - 달성률: ${stats.progress.toFixed(1)}%
    - 요일별 합계: ${summaryByDay || "데이터 없음"}
    
    [가이드]
    1. 반드시 **한국어**로만 친절하게 답변하세요.
    2. 기초적인 통계(요일별 얼마 일했나 등)는 위 '통계 요약'을 보고 즉시 답변하여 도구 호출을 아끼세요.
    3. 기록 추가/삭제/수정 등 데이터를 직접 건드릴 때만 Tool을 사용하세요.
    4. 기록 수정 시에는 최근 기록 리스트에 있는 ID를 사용하세요.
    
    최근 기록 (ID 확인용):
    ${recentEntries || "기록 없음"}`;

    const contents = [...chatHistory];
    
    if (toolResult !== null) {
        // 도구 실행 결과 추가
        contents.push({
            role: "model",
            parts: [{ functionCall: { name: toolName, args: {} } }] // 간소화
        });
        contents.push({
            role: "function",
            parts: [{ functionResponse: { name: toolName, response: { content: toolResult } } }]
        });
    } else {
        contents.push({ role: "user", parts: [{ text: `[시스템 컨텍스트]\n${systemContext}\n\n사용자 질문: ${prompt}` }] });
    }

    const payload = {
        contents,
        tools: [{
            function_declarations: [
                {
                    name: "add_work_record",
                    description: "새로운 근무 기록을 추가합니다.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string", description: "YYYY-MM-DD" },
                            startTime: { type: "string", description: "HH:mm:ss" },
                            endTime: { type: "string", description: "HH:mm:ss" },
                            type: { type: "string", enum: ["work", "holiday", "annual", "halfMorning", "halfAfternoon"] }
                        },
                        required: ["date", "type"]
                    }
                },
                {
                    name: "delete_work_record",
                    description: "특정 날짜의 근무 기록을 삭제합니다.",
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "삭제할 기록의 ID (대시보드 목록 참고)" }
                        },
                        required: ["id"]
                    }
                },
                {
                    name: "update_work_record",
                    description: "기존 근무 기록을 수정합니다.",
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "수정할 기록의 ID" },
                            startTime: { type: "string", description: "새 시작 시간 (HH:mm)" },
                            endTime: { type: "string", description: "새 종료 시간 (HH:mm)" }
                        },
                        required: ["id"]
                    }
                },
                {
                    name: "set_work_period",
                    description: "정산 시작일과 종료일을 변경합니다.",
                    parameters: {
                        type: "object",
                        properties: {
                            startDate: { type: "string", description: "시작일 (YYYY-MM-DD)" },
                            endDate: { type: "string", description: "종료일 (YYYY-MM-DD)" }
                        }
                    }
                },
                {
                    name: "get_detailed_stats",
                    description: "요일별 통계 및 심층 근무 분석 데이터를 가져옵니다.",
                    parameters: { type: "object", properties: {} }
                }
            ]
        }]
    };

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    
    if (!res.ok) {
        throw new Error(data.error?.message || `HTTP ${res.status} 오류`);
    }

    // 히스토리 업데이트
    if (data.candidates && !toolResult) {
        chatHistory.push(contents[contents.length-1]);
        chatHistory.push(data.candidates[0].content);
        if (chatHistory.length > 10) chatHistory.splice(0, 2); // 5턴 유지
    }

    return data;
}

async function handleFunctionCall(call) {
    const { name, args } = call;
    
    switch (name) {
        case 'add_work_record':
            const newEntry = {
                id: Date.now().toString(),
                date: args.date,
                type: args.type,
                startTime: args.startTime || "",
                endTime: args.endTime || "",
                seconds: 0
            };
            if (newEntry.startTime && newEntry.endTime) {
                newEntry.seconds = calculateWorkDuration(newEntry.startTime, newEntry.endTime);
            } else if (newEntry.type !== 'work' && newEntry.type !== 'holiday') {
                newEntry.seconds = (newEntry.type === 'annual') ? 28800 : 14400;
            }
            state.entries.push(newEntry);
            saveToLocalStorage();
            renderDashboard();
            return `기록 추가 완료: ${args.date} (${args.type})`;
            
        case 'delete_work_record':
            state.entries = state.entries.filter(e => e.id !== args.id);
            saveToLocalStorage();
            renderDashboard();
            return `기록 삭제 완료 (ID: ${args.id})`;

        case 'update_work_record':
            const entryToUpdate = state.entries.find(e => e.id === args.id);
            if (!entryToUpdate) return "해당 ID의 기록을 찾을 수 없습니다.";
            if (args.startTime) entryToUpdate.startTime = args.startTime;
            if (args.endTime) entryToUpdate.endTime = args.endTime;
            if (entryToUpdate.startTime && entryToUpdate.endTime) {
                entryToUpdate.seconds = calculateWorkDuration(entryToUpdate.startTime, entryToUpdate.endTime);
            }
            saveToLocalStorage();
            renderDashboard();
            return `기록 수정 완료 (ID: ${args.id})`;

        case 'set_work_period':
            if (args.startDate) state.startDate = args.startDate;
            if (args.endDate) state.endDate = args.endDate;
            document.getElementById('startDate').value = state.startDate;
            document.getElementById('endDate').value = state.endDate;
            saveToLocalStorage();
            renderDashboard();
            renderAll();
            return `정산 기간 변경 완료: ${state.startDate} ~ ${state.endDate}`;

        case 'get_detailed_stats':
            const detailedStats = calculateStats();
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dayStats = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 };
            
            state.entries.forEach(entry => {
                const d = new Date(entry.date);
                const dayName = days[d.getDay()];
                let dur = entry.seconds;
                if (!dur && entry.startTime && entry.endTime) {
                    dur = calculateWorkDuration(entry.startTime, entry.endTime);
                }
                dayStats[dayName] += dur || 0;
            });

            return JSON.stringify({
                summary: {
                    workedHours: (detailedStats.workedSeconds / 3600).toFixed(1),
                    targetHours: (detailedStats.targetSeconds / 3600).toFixed(1),
                    progress: (detailedStats.progress).toFixed(1) + "%"
                },
                dailyHours: Object.fromEntries(Object.entries(dayStats).map(([k,v]) => [k, (v/3600).toFixed(1) + "시간"]))
            });
            
        default:
            return "알 수 없는 명령입니다.";
    }
}

function appendMessage(sender, text) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function generateAIResponse(query) {
    const stats = calculateStats();
    const q = query.toLowerCase();
    
    if (q.includes('얼마나') || q.includes('몇 시간') || q.includes('현황') || q.includes('status') || q.includes('worked')) {
        return `현재까지 총 ${formatSecondsToHHMMSS(stats.workedSeconds)} 일하셨습니다. 목표 대비 ${(stats.progress).toFixed(1)}% 달성 중이에요!`;
    }
    if (q.includes('몇 시') || q.includes('퇴근') || q.includes('언제') || q.includes('leave') || q.includes('exit')) {
        const data = getRecommendationData();
        if (!data) return "정산 기간을 먼저 설정해 주세요!";
        if (data.remainingSeconds <= 0) return "이미 목표 시간을 달성하셨습니다! 바로 퇴근하셔도 좋습니다.";
        
        const avgStr = formatSecondsToHHMMSS(data.avgSecondsPerDay).substring(0,5);
        return `남은 기간 동안 하루 평균 약 ${avgStr} 정도 일하시면 됩니다. 오늘 ${data.baseStartTime.substring(0,5)} 출근 기준 **${data.finalExit}** 전후 퇴근을 추천드려요.`;
    }
    if (q.includes('연차') || q.includes('휴가') || q.includes('leave') || q.includes('vacation')) {
        const count = state.entries.filter(e => e.type === 'annual' || e.type.startsWith('half')).length;
        return `현재까지 총 ${count}번의 연차(또는 반차)를 사용하셨습니다.`;
    }
    if (q.includes('코어') || q.includes('핵심') || q.includes('core')) {
        return "우리 회사의 코어 타임은 오전 11시부터 오후 4시까지(11:00~16:00)입니다. 이 시간엔 꼭 자리를 지켜주세요!";
    }
    return "죄송해요, 제가 아직 학습 중이라 그 질문은 이해하기 어렵네요. 근무 시간, 퇴근 추천, 연차 등에 대해 물어봐 주세요!";
}

function saveToLocalStorage() { localStorage.setItem('flexWorkState', JSON.stringify(state)); }
function loadFromLocalStorage() { const s = localStorage.getItem('flexWorkState'); if(s) state = JSON.parse(s); }

// --- Gemini Vision OCR (Version 5.0) ---


async function processImageFile(file) {
    if (!file || !geminiApiKey) {
        if (!geminiApiKey) alert("API 키를 먼저 설정해 주세요!");
        return;
    }
    
    const resultList = document.getElementById('scanResultList');
    document.getElementById('scanResultArea').style.display = 'block';
    resultList.innerHTML = "<tr><td colspan='4' style='text-align:center;'>🤖 이미지를 분석하는 중입니다...</td></tr>";

    try {
        const base64 = await fileToBase64(file);
        const imgData = base64.split(',')[1];
        const mimeType = file.type;

        const url = `${localStorage.getItem('gemini_api_url')}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "이 이미지에서 근무 기록(날짜, 출근시간, 퇴근시간)을 모두 추출해서 JSON 배열 형식으로만 답변해줘. [{\"date\": \"YYYY-MM-DD\", \"startTime\": \"HH:MM:SS\", \"endTime\": \"HH:MM:SS\", \"type\": \"work\"}] 형식을 지켜줘. 표가 복잡해도 최대한 정확하게 읽어줘." },
                        { inline_data: { mime_type: mimeType, data: imgData } }
                    ]
                }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (!response.ok) throw new Error("API 요청 실패");
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        scannedEntries = JSON.parse(text);
        renderScanResults(scannedEntries);
    } catch (err) {
        console.error("Scan error:", err);
        resultList.innerHTML = `<tr><td colspan='4' style='color:#ff4d4d;'>❌ 분석 실패: ${err.message}</td></tr>`;
    }
}

async function handleTextScan() {
    const rawText = document.getElementById('rawTextArea').value;
    const resultList = document.getElementById('scanResultList');
    if (!rawText || !geminiApiKey) {
        if (!geminiApiKey) alert("API 키를 먼저 설정해 주세요!");
        return;
    }

    const scanResultArea = document.getElementById('scanResultArea');
    scanResultArea.style.display = 'block';
    resultList.innerHTML = "<tr><td colspan='4' style='text-align:center;'>🤖 텍스트를 분석하는 중입니다...</td></tr>";

    try {
        const url = `${localStorage.getItem('gemini_api_url')}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `다음 텍스트에서 근무 기록을 추출해서 JSON 배열로 반환해줘. [{\"date\": \"YYYY-MM-DD\", \"startTime\": \"HH:MM:SS\", \"endTime\": \"HH:MM:SS\", \"type\": \"work\"}] 형식만 사용해. 텍스트: ${rawText}` }]
                }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (!response.ok) throw new Error("API 요청 실패");
        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text;
        scannedEntries = JSON.parse(resultText);
        renderScanResults(scannedEntries);
    } catch (err) {
        console.error("Text scan error:", err);
        resultList.innerHTML = `<tr><td colspan='4' style='color:#ff4d4d;'>❌ 분석 실패: ${err.message}</td></tr>`;
    }
}

function renderScanResults(entries) {
    const tbody = document.getElementById('scanResultList');
    tbody.innerHTML = "";
    
    entries.forEach((entry, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${entry.date}</td>
            <td>${entry.startTime} ~ ${entry.endTime}</td>
            <td>${entry.type === 'work' ? '근무' : entry.type}</td>
            <td style="text-align:center;"><input type="checkbox" checked data-idx="${idx}"></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveScannedData() {
    const checked = document.querySelectorAll('#scanResultList input[type="checkbox"]:checked');
    if (checked.length === 0) {
        alert("선택된 항목이 없습니다.");
        return;
    }
    
    let count = 0;
    checked.forEach(cb => {
        const entry = scannedEntries[parseInt(cb.dataset.idx)];
        let seconds = 0;
        if (entry.startTime && entry.endTime) {
            seconds = calculateWorkDuration(entry.startTime, entry.endTime);
        } else if (entry.type === 'annual') {
            seconds = 8 * 3600;
        } else {
            seconds = 4 * 3600;
        }

        state.entries.push({
            id: Date.now() + count,
            date: entry.date,
            type: entry.type || 'work',
            seconds: seconds,
            startTime: entry.startTime || "",
            endTime: entry.endTime || ""
        });
        count++;
    });

    state.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveToLocalStorage();
    renderAll();
    hideModal('aiScanModal');
    appendMessage('bot', `✅ ${count}개의 기록이 성공적으로 추가되었습니다!`);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
