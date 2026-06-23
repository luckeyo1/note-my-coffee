import {
    auth,
    googleProvider,
    signInWithPopup,
    onAuthStateChanged
} from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {

    // ====== Auth & Navigation (Three.js와 독립적으로 실행) ======
    const updateCtaText = (text) => {
        const span = document.querySelector('#btn-get-started span:first-child');
        if (span) span.textContent = text;
    };

    onAuthStateChanged(auth, (user) => {
        updateCtaText(user ? '콘솔로 이동하기' : '지금 무료로 저장하기');
    });

    const btnGetStarted = document.getElementById('btn-get-started');
    if (btnGetStarted) {
        btnGetStarted.addEventListener('click', async () => {
            if (auth.currentUser) {
                window.location.href = 'app.html';
                return;
            }
            try {
                await signInWithPopup(auth, googleProvider);
                window.location.href = 'app.html';
            } catch (error) {
                console.error("Login failed", error);
                // 팝업을 사용자가 직접 닫은 경우를 제외하고 게스트로 진입
                if (error.code !== 'auth/popup-closed-by-user') {
                    window.location.href = 'app.html';
                }
            }
        });
    }

    // ====== Three.js 3D Background (선택적 - 실패해도 위 기능에 영향 없음) ======
    import('three').then((THREE) => {
        initThree(THREE);
    }).catch((e) => {
        console.warn('[Landing] Three.js 로드 실패, 3D 배경 없이 계속합니다.', e);
        const canvas = document.getElementById('three-canvas');
        if (canvas) canvas.style.display = 'none';
    });

    function initThree(THREE) {
        const container = document.getElementById('three-canvas');
        if (!container) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const geometry = new THREE.IcosahedronGeometry(1, 4);
        const material = new THREE.MeshStandardMaterial({
            color: 0x3d2b1f,
            roughness: 0.7,
            metalness: 0.2,
            flatShading: false
        });

        const bean = new THREE.Mesh(geometry, material);
        bean.scale.set(1.5, 0.9, 1.1);
        scene.add(bean);

        const creaseGeo = new THREE.TorusGeometry(1, 0.02, 16, 100, Math.PI);
        const creaseMat = new THREE.MeshBasicMaterial({ color: 0x2a1e16 });
        const crease = new THREE.Mesh(creaseGeo, creaseMat);
        crease.rotation.x = Math.PI / 2;
        crease.position.y = 0.45;
        bean.add(crease);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xd4af37, 2, 10);
        pointLight.position.set(2, 3, 4);
        scene.add(pointLight);

        camera.position.z = 5;

        const mouse = { x: 0, y: 0 };
        window.addEventListener('mousemove', (e) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        const animate = () => {
            requestAnimationFrame(animate);
            bean.rotation.y += 0.005;
            bean.rotation.x += (mouse.y * 0.5 - bean.rotation.x) * 0.05;
            bean.rotation.y += (mouse.x * 0.5 - bean.rotation.y) * 0.05;
            bean.position.y = Math.sin(Date.now() * 0.001) * 0.2;
            renderer.render(scene, camera);
        };

        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
});
