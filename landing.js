import * as THREE from 'three';
import { 
    auth, 
    googleProvider, 
    signInWithPopup, 
    onAuthStateChanged 
} from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- Auth Check ---
    onAuthStateChanged(auth, (user) => {
        const btnText = document.querySelector('#btn-get-started span') || document.getElementById('btn-get-started');
        if (user) {
            // Logged in: Change button text but don't force redirect
            if (btnText) btnText.textContent = '콘솔로 이동하기';
            document.querySelectorAll('.btn-get-started-alt').forEach(btn => {
                btn.textContent = '지금 바로 시작하기';
            });
        } else {
            if (btnText) btnText.textContent = '지금 무료로 시작하기';
        }
    });

    const btnGetStarted = document.getElementById('btn-get-started');
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
            if (error.code !== 'auth/popup-closed-by-user') {
                alert("로그인에 실패했습니다. 다시 시도하거나 게스트로 탐색해 주세요.");
            }
        }
    });

    // --- Three.js Scene ---
    const initThree = () => {
        const container = document.getElementById('three-canvas');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // Coffee Bean-ish Geometry (Spheroid)
        const geometry = new THREE.IcosahedronGeometry(1, 4);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x3d2b1f, 
            roughness: 0.7, 
            metalness: 0.2,
            flatShading: false
        });
        
        const bean = new THREE.Mesh(geometry, material);
        bean.scale.set(1.5, 0.9, 1.1); // Flatten it to look more like a bean
        scene.add(bean);

        // Add a crease (the characteristic line on a coffee bean)
        const creaseGeo = new THREE.TorusGeometry(1, 0.02, 16, 100, Math.PI);
        const creaseMat = new THREE.MeshBasicMaterial({ color: 0x2a1e16 });
        const crease = new THREE.Mesh(creaseGeo, creaseMat);
        crease.rotation.x = Math.PI / 2;
        crease.position.y = 0.45;
        bean.add(crease);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xd4af37, 2, 10);
        pointLight.position.set(2, 3, 4);
        scene.add(pointLight);

        camera.position.z = 5;

        // Animation
        const mouse = { x: 0, y: 0 };
        window.addEventListener('mousemove', (e) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        const animate = () => {
            requestAnimationFrame(animate);
            
            // Subtle rotation
            bean.rotation.y += 0.005;
            
            // Mouse tracking
            bean.rotation.x += (mouse.y * 0.5 - bean.rotation.x) * 0.05;
            bean.rotation.y += (mouse.x * 0.5 - bean.rotation.y) * 0.05;
            
            // Floating movement
            bean.position.y = Math.sin(Date.now() * 0.001) * 0.2;
            
            renderer.render(scene, camera);
        };

        animate();

        // Resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    };

    initThree();
});
