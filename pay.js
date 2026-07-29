// Note My Coffee — 랜딩페이지 토스페이먼츠 테스트 결제 (샌드박스)
// 문서용 공개 테스트 키라서 결제창까지 전부 동작하지만 실제 돈은 빠져나가지 않는다.
// @docs https://docs.tosspayments.com/sdk/v2/js
(function () {
  'use strict';

  var SDK_URL = 'https://js.tosspayments.com/v2/standard';
  // 토스 문서에 공개된 샌드박스 클라이언트 키. 실 연동 시 개발자센터의 내 키로 교체.
  var CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
  var AMOUNTS = [3000, 5000, 10000];
  var DEFAULT_AMOUNT = 5000;

  var widgets = null;
  var amount = DEFAULT_AMOUNT;

  document.addEventListener('DOMContentLoaded', function () {
    var btnOpen = document.getElementById('btn-open-pay');
    if (btnOpen) btnOpen.addEventListener('click', openPayPanel);
  });

  function won(value) {
    return value.toLocaleString('ko-KR') + '원';
  }

  function showError(message) {
    var el = document.getElementById('pay-error');
    el.textContent = message;
    el.hidden = false;
  }

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.TossPayments) return resolve();
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('토스페이먼츠 SDK를 불러오지 못했습니다.')); };
      document.head.appendChild(s);
    });
  }

  async function openPayPanel() {
    window.nmcTrack?.('support_open');
    var btnOpen = document.getElementById('btn-open-pay');
    btnOpen.disabled = true;
    btnOpen.querySelector('span:first-child').textContent = '불러오는 중…';
    document.getElementById('pay-error').hidden = true;

    var panel = document.getElementById('pay-panel');
    // 실패 후 재시도할 때 이전 시도의 잔여 iframe이 남지 않도록 비운다.
    document.getElementById('payment-method').innerHTML = '';
    document.getElementById('agreement').innerHTML = '';

    try {
      await loadSdk();

      var tossPayments = TossPayments(CLIENT_KEY);
      // 비회원(익명) 결제 — 랜딩 데모라 고객 식별이 필요 없다.
      widgets = tossPayments.widgets({ customerKey: TossPayments.ANONYMOUS });

      // 금액 설정은 render/requestPayment보다 반드시 먼저.
      await widgets.setAmount({ currency: 'KRW', value: amount });

      // 위젯은 display:none 컨테이너에서는 로드가 끝나지 않는다 — 패널을 먼저 연다.
      panel.hidden = false;
      btnOpen.hidden = true;

      await Promise.all([
        widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
        widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' })
      ]);

      renderAmountChips();
      document.getElementById('btn-pay').addEventListener('click', requestPayment);
    } catch (e) {
      console.error('[Pay] 위젯 초기화 실패', e);
      showError(e && e.message ? e.message : '결제 위젯을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      panel.hidden = true;
      btnOpen.hidden = false;
      btnOpen.disabled = false;
      btnOpen.querySelector('span:first-child').textContent = '테스트 결제 열어보기';
    }
  }

  function renderAmountChips() {
    var wrap = document.getElementById('pay-amounts');
    wrap.innerHTML = '';
    AMOUNTS.forEach(function (value) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pay-chip' + (value === amount ? ' active' : '');
      chip.textContent = won(value);
      chip.addEventListener('click', function () { selectAmount(value, chip); });
      wrap.appendChild(chip);
    });
  }

  async function selectAmount(value, chip) {
    if (!widgets || value === amount) return;
    amount = value;
    document.querySelectorAll('.pay-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    document.getElementById('btn-pay-label').textContent = won(value) + ' 테스트 결제하기';
    try {
      await widgets.setAmount({ currency: 'KRW', value: value });
    } catch (e) {
      console.error('[Pay] 금액 변경 실패', e);
    }
  }

  async function requestPayment() {
    if (!widgets) return;
    window.nmcTrack?.('support_pay_attempt', { amount: amount });
    document.getElementById('pay-error').hidden = true;
    try {
      await widgets.requestPayment({
        orderId: 'nmc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
        orderName: '커피 한 잔 후원 (테스트)',
        successUrl: window.location.origin + '/pay-success.html',
        failUrl: window.location.origin + '/pay-fail.html'
      });
    } catch (e) {
      // 사용자가 결제창을 직접 닫은 건 오류가 아니다.
      if (e && e.code === 'USER_CANCEL') return;
      console.error('[Pay] 결제 요청 실패', e);
      showError(e && e.message ? e.message : '결제 요청에 실패했습니다.');
    }
  }
})();
