# **AI Development Guidelines for Modern Web Projects in Firebase Studio**

These guidelines define the operational principles and capabilities of an AI agent (e.g., Gemini) interacting with framework-less web projects (HTML, CSS, JavaScript) within the Firebase Studio environment. The goal is to enable an efficient, automated, and error-resilient application design and development workflow that leverages modern, widely supported web standards (Baseline).

## **Environment & Context Awareness**

The AI operates within the Firebase Studio development environment, which provides a Code OSS-based IDE and a simple, pre-configured environment for web development.

* **Project Structure:** The AI assumes a basic web project structure. The primary entry point is `index.html`. CSS and JavaScript are expected to be in files like `style.css` and `main.js`, linked from the HTML.
* **`dev.nix` Configuration:** The AI is aware of the `.idx/dev.nix` file for environment configuration, which may include tools like `pkgs.nodejs` for development servers or build tools.
* **Preview Server:** Firebase Studio provides a running preview server. The AI will monitor the server's output (e.g., console logs, network requests) for real-time feedback on changes.
* **Firebase Integration:** The AI recognizes standard Firebase integration patterns, such as including the Firebase SDKs from the CDN and initializing the app with a configuration object.

## **Code Modification & Dependency Management**

The AI is empowered to modify the codebase autonomously based on user requests.  The AI is creative and anticipates features that the user might need even if not explicitly requested.

* **Core Code Assumption:** The AI will primarily modify `.html`, `.css`, and `.js` files. It will create new files as needed and ensure they are correctly linked in `index.html`.
* **Dependency Management:** For a framework-less project, the AI will prefer to use ES Modules for JavaScript, importing/exporting functionality between files. For third-party libraries, it will use CDN links with Subresource Integrity (SRI) hashes for security, or install them via npm if a `package.json` is present.

## **Modern HTML: Web Components**

The AI will use Web Components to create encapsulated, reusable UI elements without external frameworks.

* **Custom Elements:** Define new HTML tags with custom behavior using JavaScript classes.
* **Shadow DOM:** Encapsulate a component's HTML structure, styling, and behavior, preventing conflicts with the main document.
* **HTML Templates (`<template>` and `<slot>`):** Create inert chunks of markup to be cloned and used in custom elements, with slots for flexible content injection.

*Example of a simple Web Component:*

```javascript
// in main.js
class SimpleGreeting extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const wrapper = document.createElement('span');
    wrapper.setAttribute('class', 'wrapper');
    const text = document.createElement('p');
    text.textContent = `Hello, ${this.getAttribute('name') || 'World'}!`;
    const style = document.createElement('style');
    style.textContent = `
      .wrapper {
        padding: 15px;
        border: 1px solid #ccc;
        border-radius: 8px;
      }
    `;
    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    wrapper.appendChild(text);
  }
}
customElements.define('simple-greeting', SimpleGreeting);

// in index.html
// <simple-greeting name="User"></simple-greeting>
```

## **Modern CSS (Baseline Features)**

The AI will use modern, widely supported CSS features to create responsive and maintainable styles.

* **Container Queries (`@container`):** Create components that respond to the size of their parent container, not just the viewport.
* **Cascade Layers (`@layer`):** Manage the CSS cascade with explicit layers to prevent style conflicts, especially when integrating third-party styles.
* **The `:has()` Selector:** Select parent elements based on their children, simplifying complex styling scenarios without JavaScript.
* **Logical Properties:** Use properties like `margin-inline-start` instead of `margin-left` for better support in different writing modes.
* **Modern Color Spaces (`oklch`, `lch`):** Use color functions that provide access to more vibrant and perceptually uniform colors.
* **CSS Variables:** Use custom properties (`--main-color: #333;`) for theming and easier maintenance.

## **Modern JavaScript (Baseline Features)**

The AI will write clean, efficient, and modern JavaScript.

* **ES Modules:** Use `import` and `export` to organize code into reusable modules.
* **Async/Await:** Handle asynchronous operations (like `fetch`) with clean, readable syntax.
* **The `fetch` API:** Make network requests to APIs.
* **Promises:** Work with asynchronous results in a structured way.
* **Modern Syntax:** Utilize arrow functions, destructuring, spread/rest operators, and optional chaining (`?.`).

## **Advanced Capabilities**

### **3D Graphics with Three.js**

When 3D graphics are requested, the AI will use the **Three.js** library.

* **Setup:** The AI will add Three.js to the project, typically via a CDN or by installing the `three` package from npm.
* **Core Concepts:** The AI will create a `Scene`, a `Camera`, and a `WebGLRenderer`. It will add `Meshes` (geometry \+ material) to the scene and render the result.
* **Performance:** For complex scenes, the AI will employ optimization techniques like reducing draw calls, using Level of Detail (LOD), and optimizing 3D assets.
* **Shaders:** For custom visual effects, the AI can write and implement GLSL shaders using `ShaderMaterial`.

### **High-Performance with WebAssembly (WASM)**

For computationally intensive tasks, the AI can integrate WebAssembly modules.

* **Use Cases:** Ideal for tasks like in-browser image/video processing, scientific simulations, or games.
* **Integration:** The AI will load and instantiate the `.wasm` file using the `WebAssembly` JavaScript API and call its exported functions. It will manage the data transfer between JavaScript and WASM efficiently.

## **Automated Error Detection & Remediation**

A critical function of the AI is to continuously monitor for and automatically resolve errors to maintain a runnable and correct application state.

* **Post-Modification Checks:** After every code modification, the AI will:
  1. Monitor the IDE's diagnostics (problem pane) for errors.
  2. Check the browser preview's developer console for runtime errors, 404s, and rendering issues.
* **Automatic Error Correction:** The AI will attempt to automatically fix detected errors. This includes, but is not limited to:
  * Syntax errors in HTML, CSS, or JavaScript.
  * Incorrect file paths in `<script>`, `<link>`, or `<img>` tags.
  * Common JavaScript runtime errors.
* **Problem Reporting:** If an error cannot be automatically resolved, the AI will clearly report the specific error message, its location, and a concise explanation with a suggested manual intervention or alternative approach to the user.

## **Visual Design**

**Aesthetics:** The AI always makes a great first impression by creating a unique user experience that incorporates modern components, a visually balanced layout with clean spacing, and polished styles that are easy to understand.

1. Build beautiful and intuitive user interfaces that follow modern design guidelines.
2. Ensure your app is mobile responsive and adapts to different screen sizes, working perfectly on mobile and web.
3. Propose colors, fonts, typography, iconography, animation, effects, layouts, texture, drop shadows, gradients, etc.
4. If images are needed, make them relevant and meaningful, with appropriate size, layout, and licensing (e.g., freely available). If real images are not available, provide placeholder images.
5. If there are multiple pages for the user to interact with, provide an intuitive and easy navigation bar or controls.

**Bold Definition:** The AI uses modern, interactive iconography, images, and UI components like buttons, text fields, animation, effects, gestures, sliders, carousels, navigation, etc.

> **주의 — 아래 원칙은 이 프로젝트에 맞게 교체됐다.**
> 원래 여기에는 "배경에 미묘한 노이즈 텍스처", "다층 드롭섀도우로 강한 깊이감",
> "인터랙티브 요소에 글로우 효과" 같은 범용 지침이 있었다. 그 지침대로 만든 결과
> 서비스가 **AI가 찍어낸 것처럼 보였고**(근사 검정 + 단일 골드, 세리프 디스플레이 +
> 산세리프 본문, 노이즈·그라디언트·섀도우·라운드 남발) 2026-08 전면 재디자인에서
> 전부 걷어냈다. 아래 원칙을 따르라. 되돌리지 말 것.

**디자인 방향: 계측기(러버서브 노트).** 이 제품은 추출을 0.1g·0.1°C 단위로 재는
도구다. 화면도 그렇게 생겨야 한다 — 럭셔리 카페가 아니라 기록지와 계기다.

1. **서체** \- `IBM Plex` 한 패밀리로 통일한다(Sans / Sans KR / Mono). Plex는 한글
   정식 컷이 있어 라틴과 한글이 한 체계로 붙는다. **세리프 디스플레이 + 산세리프
   본문 조합을 쓰지 말 것** — 그 조합 자체가 AI 기본값이다. 디스플레이는 Plex Sans를
   크게·자간 좁혀 쓴다.
2. **숫자** \- 도징·온도·시간·수율·비율 등 **모든 수치는 Plex Mono + `tabular-nums`**로
   조판한다. 값과 단위를 분리해 계기판 리드아웃처럼 보이게 한다.
3. **색** \- 종이(`--paper #FBFAF8`) 위 잉크(`--ink #15120E`). 신호색은 계기 블루
   (`--signal #0E4C7A`) **하나뿐**이다. 상태색(good/bad)은 액센트와 별개 체계로 둔다.
   팔레트를 넓히지 말 것 — 절제가 이 디자인의 성격이다.
4. **질감·깊이 없음** \- 노이즈 텍스처, 그라디언트, 드롭섀도우, 글로우,
   `backdrop-filter`를 **쓰지 않는다.** 종이는 평면이다.
5. **구획은 괘선과 여백** \- 카드와 그림자 대신 1px 헤어라인(`--rule`)과 여백으로
   나눈다. `border-radius`는 0이다(원형 뱃지 등 기능상 원이어야 하는 것만 예외).
6. **정렬** \- 좌측 정렬이 기본이다. 중앙 정렬은 의도가 분명할 때만.
7. **접근성** \- 본문 대비 4.5:1 이상을 지킨다. 이번 재디자인에서 세 페이지 모두
   미달 0건으로 맞춰뒀으니 색을 바꾸면 다시 검사할 것.

## **Accessibility or A11Y Standards:** The AI implements accessibility features to empower all users, assuming a wide variety of users with different physical abilities, mental abilities, age groups, education levels, and learning styles.

## **Iterative Development & User Interaction**

The AI's workflow is iterative, transparent, and responsive to user input.

* **Plan Generation & Blueprint Management:** Each time the user requests a change, the AI will first generate a clear plan overview and a list of actionable steps. This plan will then be used to **create or update a blueprint.md file** in the project's root directory.
  * The `blueprint.md` file will serve as a single source of truth, containing:
    * A section with a concise overview of the purpose and capabilities.
    * A section with a detailed outline documenting the project, including *all style, design, and features* implemented in the application from the initial version to the current version.
    * A section with a detailed section outlining the plan and steps for the *current* requested change.
    *
  * Before initiating any new change, the AI will reference the `blueprint.md` to ensure full context and understanding of the application's current state.
* **Prompt Understanding:** The AI will interpret user prompts to understand the desired changes. It will ask clarifying questions if the prompt is ambiguous.
* **Contextual Responses:** The AI will provide conversational responses, explaining its actions, progress, and any issues encountered. It will summarize changes made.
* **Error Checking Flow:**
  1. **Code Change:** AI applies a code modification.
  2. **Dependency Check:** If a `package.json` was modified, AI runs `npm install`.
  3. **Preview Check:** AI observes the browser preview and developer console for visual and runtime errors.
  4. **Remediation/Report:** If errors are found, AI attempts automatic fixes. If unsuccessful, it reports details to the user.


# 취향 검사 추천 원두 링크 유지보수

`index.html`의 취향 검사 섹션(`#quiz`)에는 프로필(A~D) 4종 × 원두 3개의 추천
데이터(`RESULTS`)가 있다. 원두마다 **컬리·네이버 검색 링크 두 개**가 붙는다.

**개별 상품 URL은 쓰지 않는다 — 규칙이 아니라 이미 실패한 방식이다.**
한때 컬리 `/goods/<no>`, 홈바리스타클럽 `goodsNo=<no>`로 상품을 직접 걸었다가
링크가 통째로 죽었다. 상품은 품절되고, 상품번호는 재입고마다 새로 발급되고,
홈바리스타클럽 콜라보 원두는 공동구매 일회성이라 영구 품절로 남는다.
지금은 각 원두의 `query`(검색어)만 두고 빌더가 URL을 만든다:

```js
const kurlySearch = (q) => 'https://www.kurly.com/search?sword=' + encodeURIComponent(q);
const naverSearch = (q) => 'https://search.naver.com/search.naver?query=' + encodeURIComponent(q);
```

네이버는 **통합검색**이다. `search.shopping.naver.com`은 봇 차단·경로 이전으로
안 열리는 경우가 있어 쓰지 않는다.

**주간 점검**: `.github/workflows/bean-link-check.yml` → `scripts/check-bean-links.mjs`.
검사하는 것은 (1) 검색 진입점 두 개가 열리는지, (2) 금지된 상품 URL 형태가
`index.html`에 다시 들어왔는지 두 가지다. 실패 시 `dead-links.json`이 생긴다.

**원두를 교체할 때**

- **인지도 있는 국내 로스터리/브랜드**로 고른다 (프릳츠, 커피리브레, 모모스커피,
  테라로사, 앤트러사이트, 나무사이로, 센터커피, 빈브라더스, 블루보틀, 폴 바셋 등).
- 취향 프로필과 맛 방향을 맞춘다: A 라이트·플로럴/산미, B 미디엄·밸런스,
  C 고소·초콜릿(라떼), D 다크·묵직.
- `name`(상품명)·`roaster`(로스터리)·`desc`(맛 설명)·`query`(검색어)를 함께 고쳐
  서로 어긋나지 않게 한다.
- `query`는 **브랜드 + 원두**처럼 넓게 잡는다. 특정 상품명으로 좁히면 그 상품이
  빠졌을 때 검색 결과가 비어버려, 상품 URL을 쓰던 때와 같은 문제가 된다.
- 시즌 한정·디카페인·드립백은 피하고 상시 판매 라인을 고른다.
  **공동구매·콜라보 상품은 절대 넣지 않는다.**
- 커밋 전 `node scripts/check-bean-links.mjs` 통과 확인. `#quiz` 데이터 외의 코드는
  수정하지 않는다.

**제휴 전환 예정**: 제휴(쇼핑 커넥트/링크프라이스) 승인 후에는 위 빌더 두 개만
제휴 딥링크로 교체한다. 결과 하단 `.quiz-note` 고지 문구도 함께 맞춘다.

# Firebase MCP

When requested for Firebase add the following the server configurations to .idx/mcp.json. Just add the following and don't add anything else.

{
    "mcpServers": {
        "firebase": {
            "command": "npx",
            "args": [
                "-y",
                "firebase-tools@latest",
                "experimental:mcp"
            ]
        }
    }
}