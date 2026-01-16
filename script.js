import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCsnZdFrg-KlWFc0z6OgmXgBp6lPKf14fU",
    authDomain: "saifsa-b51f1.firebaseapp.com",
    databaseURL: "https://saifsa-b51f1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "saifsa-b51f1",
    storageBucket: "saifsa-b51f1.firebasestorage.app",
    messagingSenderId: "41089917871",
    appId: "1:41089917871:web:fce49f6f23bd4f679b055a",
    measurementId: "G-4K733KS3CP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.currentTeacherPackages = {}; 
let currentTeacherName = "";
let currentExamQuestions = [];
let currentUser = JSON.parse(localStorage.getItem('nokhba_user'));

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

window.switchView = function(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active-view'));
    const iframe = document.getElementById('page-video-frame');
    iframe.src = iframe.src; 
    
    setTimeout(() => {
        const target = document.getElementById(viewId);
        if(target) target.classList.add('active-view');
    }, 50);
    window.scrollTo(0,0);
}

window.openTeacherPage = function(tId, name, img, bio, subject) {
    currentTeacherName = name;
    document.getElementById('tp-name').innerText = name;
    document.getElementById('tp-img').src = img;
    document.getElementById('tp-bio').innerText = bio;
    fetchPackages(tId);
    switchView('teacher-view');
}

function fetchPackages(teacherId) {
    const list = document.getElementById('packages-list');
    list.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:3rem; color:var(--primary); margin:auto;"></i>';
    const packagesRef = ref(db, `teachers/${teacherId}/packages`);
    
    let userSubs = {};
    if(currentUser) {
        const userSubRef = ref(db, `users/${currentUser.phone}/subscriptions`);
        onValue(userSubRef, (snap) => {
            userSubs = snap.val() || {};
            loadPackagesUI();
        });
    } else {
        onValue(packagesRef, (snapshot) => {
            window.currentTeacherPackages = snapshot.val() || {};
            loadPackagesUI();
        });
    }

    function loadPackagesUI() {
        get(packagesRef).then((snapshot) => {
            list.innerHTML = ''; 
            if (!snapshot.exists()) {
                list.innerHTML = `
                    <div style="text-align:center; padding:40px;">
                            <img src="https://cdn-icons-png.flaticon.com/512/7486/7486831.png" style="width:120px; opacity:0.8;">
                            <h3 style="margin-top:20px; color:var(--text-light);">لا يوجد محتوى حالياً</h3>
                    </div>`;
                return;
            }
            const data = snapshot.val();
            window.currentTeacherPackages = data;

            Object.entries(data).forEach(([pkgId, pkg]) => {
                const pkgImg = pkg.image || 'https://via.placeholder.com/300x200';
                const pkgType = pkg.type || 'كورس';
                const pkgPrice = pkg.price ? `${pkg.price} EGP` : 'مجاني';
                
                let btnText = `اشترك الآن <i class="fas fa-arrow-left"></i>`;
                let btnAction = `openPaymentModal('${pkgId}', '${pkg.title}', '${pkg.price}')`;
                let btnClass = "pkg-btn";

                if(currentUser && userSubs[pkgId]) {
                    const status = userSubs[pkgId].status;
                    if(status === 'active') {
                        btnText = `ادخل الكورس <i class="fas fa-door-open"></i>`;
                        btnAction = `openCourseDetails('${pkgId}')`;
                        btnClass = "pkg-btn btn-success";
                    } else if (status === 'pending') {
                        btnText = `في انتظار المراجعة <i class="fas fa-clock"></i>`;
                        btnAction = `alert('طلبك قيد المراجعة من الإدارة، سيتم تفعيل الكورس قريباً')`;
                        btnClass = "pkg-btn btn-pending";
                    } else if (status === 'rejected') {
                        btnText = `تم الرفض (حاول مجدداً) <i class="fas fa-times"></i>`;
                        btnAction = `openPaymentModal('${pkgId}', '${pkg.title}', '${pkg.price}')`;
                        btnClass = "pkg-btn btn-wrong";
                    }
                }

                const card = document.createElement('div');
                card.className = 'pkg-card';
                card.innerHTML = `
                    <div class="pkg-img-box">
                        <img src="${pkgImg}">
                        <div class="pkg-type-badge">${pkgType}</div>
                    </div>
                    <div class="pkg-body">
                        <h3 class="pkg-title">${pkg.title}</h3>
                        <div class="pkg-price">${pkgPrice}</div>
                        <p class="pkg-desc">${pkg.description || 'محتوى تعليمي شامل'}</p>
                        <button class="${btnClass}" onclick="${btnAction}">${btnText}</button>
                    </div>
                `;
                list.appendChild(card);
            });
        });
    }
}

window.openPaymentModal = function(pkgId, title, price) {
    if(!currentUser) {
        alert("يجب تسجيل الدخول أولاً للاشتراك");
        openAuthModal('login');
        return;
    }
    document.getElementById('payment-modal').classList.add('active');
    document.getElementById('pay-pkg-id').value = pkgId;
    document.getElementById('pay-pkg-price').value = price;
    document.getElementById('payment-amount-display').innerText = `المبلغ المطلوب: ${price} جنيه`;
}

window.handlePaymentSubmit = async function(e) {
    e.preventDefault();
    const pkgId = document.getElementById('pay-pkg-id').value;
    const senderPhone = document.getElementById('pay-sender-phone').value;
    const fileInput = document.getElementById('pay-receipt');
    
    if(fileInput.files.length === 0) return alert("يرجى رفع صورة التحويل");

    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'جاري الرفع... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const base64Img = await toBase64(fileInput.files[0]);

        const requestData = {
            userId: currentUser.phone,
            userName: currentUser.name,
            packageId: pkgId,
            pkgTitle: window.currentTeacherPackages[pkgId].title,
            senderPhone: senderPhone,
            receiptImage: base64Img,
            status: 'pending',
            timestamp: Date.now()
        };

        const newReqRef = push(ref(db, 'requests'));
        await set(newReqRef, requestData);

        await update(ref(db, `users/${currentUser.phone}/subscriptions/${pkgId}`), {
            status: 'pending',
            reqId: newReqRef.key,
            timestamp: Date.now()
        });

        alert("تم إرسال طلب الاشتراك بنجاح! سيتم مراجعة الطلب وتفعيل الكورس.");
        document.getElementById('payment-modal').classList.remove('active');
        
        fetchPackages(Object.keys(window.currentTeacherPackages)[0]);
        
    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء الإرسال");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

window.openCourseDetails = function(pkgId) {
    const userSubRef = ref(db, `users/${currentUser.phone}/subscriptions/${pkgId}`);
    get(userSubRef).then(snap => {
        if(snap.exists() && snap.val().status === 'active') {
                const pkg = window.currentTeacherPackages[pkgId];
            if(!pkg) return;
            document.getElementById('cd-title').innerText = pkg.title;
            document.getElementById('cd-type').innerText = pkg.type || 'كورس';
            document.getElementById('cd-desc').innerText = pkg.description || '';
            const contentArea = document.getElementById('course-content-area');
            contentArea.innerHTML = '';

            if (pkg.weeks) {
                Object.entries(pkg.weeks).forEach(([wId, week]) => {
                    let contentHtml = '';
                    if (week.content) {
                        Object.entries(week.content).forEach(([cId, content]) => {
                            const isVideo = content.type === 'video';
                            const iconClass = isVideo ? 'fa-play' : 'fa-clipboard-check';
                            const iconColor = isVideo ? '#e74c3c' : '#3498db';
                            
                            let action = "";
                            if(isVideo) {
                                action = `openVideoPage('${content.url}', '${content.title}')`;
                            } else {
                                action = `openExamPage('${pkgId}', '${wId}', '${cId}')`; 
                            }

                            contentHtml += `
                                <a href="javascript:void(0)" class="content-link" onclick="${action}">
                                    <div class="c-icon" style="width:40px;height:40px;background:${iconColor};color:#fff;display:flex;align-items:center;justify-content:center;border-radius:10px;"><i class="fas ${iconClass}"></i></div>
                                    <span>${content.title}</span>
                                </a>
                            `;
                        });
                    }
                    contentArea.innerHTML += `
                        <div class="week-box">
                            <div class="week-head" onclick="toggleWeek(this)">
                                <span><i class="fas fa-calendar-week" style="color:var(--primary); margin-left:10px;"></i> ${week.title}</span>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                            <div class="week-body">${contentHtml || '<p style="padding:15px;text-align:center;color:#999;">لا يوجد محتوى</p>'}</div>
                        </div>`;
                });
            } else {
                contentArea.innerHTML = '<div style="text-align:center; padding:40px;">لا يوجد محتوى</div>';
            }
            switchView('course-details-view');
        } else {
            alert("غير مصرح لك بدخول الكورس");
        }
    });
}

window.toggleWeek = function(head) {
    head.nextElementSibling.classList.toggle('open');
    head.querySelector('.fa-chevron-down').style.transform = head.nextElementSibling.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
}

window.openVideoPage = function(url, title) {
    let embedUrl = url;
    if (url.includes('watch?v=')) embedUrl = `https://www.youtube.com/embed/${url.split('v=')[1].split('&')[0]}`;
    else if (url.includes('youtu.be/')) embedUrl = `https://www.youtube.com/embed/${url.split('youtu.be/')[1]}`;
    
    document.getElementById('page-video-frame').src = embedUrl;
    document.getElementById('page-video-title').innerText = title;
    switchView('video-view');
}

window.openExamPage = function(pkgId, wId, cId) {
    const examData = window.currentTeacherPackages[pkgId].weeks[wId].content[cId];
    
    if(!examData || !examData.questions) {
        alert("عذراً، لا توجد أسئلة مضافة لهذا الامتحان بعد.");
        return;
    }

    document.getElementById('exam-title').innerText = examData.title;
    const qArea = document.getElementById('questions-area');
    qArea.innerHTML = '';
    
    currentExamQuestions = examData.questions;

    if (Array.isArray(examData.questions)) {
        examData.questions.forEach((q, index) => {
            let optionsHtml = '';
            if(q.options) {
                q.options.forEach((opt, optIndex) => {
                    optionsHtml += `
                        <label>
                            <input type="radio" name="q_${index}" value="${optIndex}" required>
                            <span class="q-option">${opt}</span>
                        </label>
                    `;
                });
            }

            const qDiv = document.createElement('div');
            qDiv.className = 'question-box';
            qDiv.innerHTML = `<div class="q-text">${index + 1}. ${q.text || q.question}</div>${optionsHtml}`;
            qArea.appendChild(qDiv);
        });
    } 

    switchView('exam-view');
}

window.submitExam = function(e) {
    e.preventDefault();
    let score = 0;
    const reviewArea = document.getElementById('result-review-area');
    reviewArea.innerHTML = '';

    currentExamQuestions.forEach((q, index) => {
        const selected = document.querySelector(`input[name="q_${index}"]:checked`);
        const selectedVal = selected ? parseInt(selected.value) : -1;
        const correctVal = (q.correct !== undefined) ? q.correct : q.correctAnswer;
        
        const isCorrect = selectedVal == correctVal;
        
        if (isCorrect) score++;

        const statusClass = isCorrect ? 'ans-correct' : 'ans-wrong';
        const statusIcon = isCorrect ? '<i class="fas fa-check"></i> إجابة صحيحة' : '<i class="fas fa-times"></i> إجابة خاطئة';
        const yourAns = selectedVal !== -1 ? q.options[selectedVal] : 'لم يتم الإجابة';
        const correctAnsText = q.options[correctVal];

        reviewArea.innerHTML += `
            <div class="question-box" style="padding:15px;">
                <div style="font-weight:bold; margin-bottom:10px;">${index+1}. ${q.text || q.question}</div>
                <div class="answer-review ${statusClass}">
                    ${statusIcon}<br>
                    إجابتك: ${yourAns}
                    ${!isCorrect ? `<br>الإجابة الصحيحة: <strong>${correctAnsText}</strong>` : ''}
                </div>
            </div>
        `;
    });

    document.getElementById('result-score').innerText = `${score}/${currentExamQuestions.length}`;
    switchView('exam-result-view');
}

const MALE_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png"; 
const FEMALE_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140047.png"; 

window.onload = () => {
    const user = JSON.parse(localStorage.getItem('nokhba_user'));
    if (user) {
        document.getElementById('nav-guest-area').style.display = 'none';
        document.getElementById('nav-user-area').style.display = 'block';
        document.getElementById('nav-user-name').innerText = user.name.split(' ')[0];
        document.getElementById('nav-user-avatar').src = user.avatar;
    }
};

window.openAuthModal = (mode) => {
    document.getElementById('auth-modal').classList.add('active');
    window.toggleAuthMode(mode);
}
window.closeAuthModal = () => document.getElementById('auth-modal').classList.remove('active');

window.toggleAuthMode = (mode) => {
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-register');
    const title = document.getElementById('auth-title');
    if (mode === 'login') {
        loginForm.style.display = 'block'; regForm.style.display = 'none';
        title.innerText = 'تسجيل الدخول';
        document.getElementById('tab-login').style.borderBottomColor = 'var(--primary)';
        document.getElementById('tab-register').style.borderBottomColor = 'transparent';
    } else {
        loginForm.style.display = 'none'; regForm.style.display = 'block';
        title.innerText = 'حساب جديد';
        document.getElementById('tab-register').style.borderBottomColor = 'var(--primary)';
        document.getElementById('tab-login').style.borderBottomColor = 'transparent';
    }
}

window.handleRegister = (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const pass = document.getElementById('reg-pass').value;
    const user = { name, phone, password: pass, avatar: MALE_AVATAR };
    localStorage.setItem('nokhba_user', JSON.stringify(user));
    location.reload();
}

window.handleLogin = (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const pass = document.getElementById('login-pass').value;
    const saved = JSON.parse(localStorage.getItem('nokhba_user'));
    if (saved && saved.phone === phone && saved.password === pass) location.reload();
    else alert('بيانات خاطئة');
}

window.openProfileModal = () => {
    const user = JSON.parse(localStorage.getItem('nokhba_user'));
    document.getElementById('edit-name').value = user.name;
    document.getElementById('edit-phone').value = user.phone;
    document.getElementById('edit-avatar-preview').src = user.avatar;
    document.getElementById('profile-modal').classList.add('active');
}

window.logout = () => {
    if(confirm('تسجيل الخروج؟')) {
        localStorage.removeItem('nokhba_user');
        location.reload();
    }
}

window.toggleTheme = () => {
    const body = document.body;
    body.setAttribute('data-theme', body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
window.toggleMenu = () => document.getElementById('navLinks').classList.toggle('active');

window.shareSite = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'منصة النخبة التعليمية',
                text: 'أقوى مدرسي الثانوية العامة في مكان واحد',
                url: window.location.href
            });
        } catch (err) {
            console.log('Error sharing', err);
        }
    } else {
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = window.location.href;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        
        const toast = document.getElementById('toast');
        const msg = document.getElementById('toast-msg');
        msg.innerText = 'تم نسخ الرابط بنجاح';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}
