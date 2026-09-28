// 로또 6/45 회차별 당첨 정보 프록시 (동행복권 → 실패 시 공개 미러)
const FIRST_DRAW = Date.UTC(2002, 11, 7, 12, 0); // 2002-12-07 21:00 KST
const WEEK = 7 * 24 * 3600 * 1000;
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';

function drawDateOf(no) {
  const d = new Date(Date.UTC(2002, 11, 7) + (no - 1) * WEEK);
  return d.toISOString().slice(0, 10);
}
function expectedLatest() {
  return Math.floor((Date.now() - FIRST_DRAW) / WEEK) + 1;
}
async function getJson(url, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    if (!ct.includes('json') && !text.trim().startsWith('{')) throw new Error('JSON 아님');
    return JSON.parse(text);
  } finally { clearTimeout(t); }
}

async function fromDhlottery(no) {
  const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${no}`;
  const data = await getJson(url, {
    'User-Agent': UA,
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'AJAX': 'true',
    'Referer': 'https://www.dhlottery.co.kr/lt645/result',
  });
  const list = (data && data.data && data.data.list) || [];
  const item = list.find(i => Number(i.ltEpsd) === no);
  if (!item) {
    const max = list.length ? Math.max(...list.map(i => Number(i.ltEpsd))) : null;
    return { found: false, latest: max };
  }
  const ymd = String(item.ltRflYmd || '');
  return {
    found: true,
    tallied: Number(item.rnk5WnNope) > 0,
    draw: {
      round: no,
      date: ymd.length === 8 ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}` : drawDateOf(no),
      numbers: [1, 2, 3, 4, 5, 6].map(k => Number(item[`tm${k}WnNo`])),
      bonus: Number(item.bnsWnNo),
      ranks: [1, 2, 3, 4, 5].map(k => ({
        rank: k,
        amount: Number(item[`rnk${k}WnAmt`] || 0),
        winners: Number(item[`rnk${k}WnNope`] || 0),
        total: Number(item[`rnk${k}SumWnAmt`] || 0),
      })),
      sales: Number(item.rlvtEpsdSumNtslAmt || 0),
      firstByType: { auto: Number(item.winType1 || 0), manual: Number(item.winType2 || 0), semi: Number(item.winType3 || 0) },
    },
  };
}

async function fromMirror(no) {
  const url = `https://raw.githubusercontent.com/johyunchol/lottogo-python/main/src/constant/draw_no/${no}.json`;
  const d = await getJson(url, { 'User-Agent': UA });
  return {
    found: true,
    tallied: (d.rank_details || []).some(r => r.rank === 5 && r.num_winners > 0),
    draw: {
      round: no,
      date: d.draw_date,
      numbers: d.winning_numbers,
      bonus: d.bonus_number,
      ranks: d.rank_details.map(r => ({ rank: r.rank, amount: r.prize_per_game, winners: r.num_winners, total: r.total_prize_amount })),
      sales: (d.misc_info && d.misc_info.total_sales_amount) || 0,
      firstByType: null,
    },
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const no = parseInt(req.query.no, 10);
  if (!Number.isInteger(no) || no < 1 || no > 99999) {
    res.status(400).json({ ok: false, error: '회차 번호가 올바르지 않습니다.' });
    return;
  }
  const latest = expectedLatest();
  if (no > latest) {
    res.setHeader('Cache-Control', 's-maxage=120');
    res.json({ ok: true, status: 'pending', round: no, drawDate: drawDateOf(no) });
    return;
  }
  let result = null, source = null, errors = [];
  try { result = await fromDhlottery(no); source = 'dhlottery'; } catch (e) { errors.push('dh: ' + e.message); }
  if (!result || !result.found || !result.tallied) {
    try {
      const m = await fromMirror(no);
      if (m.found && m.tallied) { result = m; source = 'mirror'; }
    } catch (e) { errors.push('mirror: ' + e.message); }
  }
  if (!result) {
    res.status(502).json({ ok: false, error: '당첨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.', detail: errors });
    return;
  }
  if (!result.found) {
    res.setHeader('Cache-Control', 's-maxage=120');
    res.json({ ok: true, status: 'pending', round: no, drawDate: drawDateOf(no) });
    return;
  }
  const status = result.tallied ? 'done' : 'tallying';
  res.setHeader('Cache-Control', status === 'done' ? 's-maxage=86400, stale-while-revalidate=604800' : 's-maxage=120');
  res.json({ ok: true, status, source, draw: result.draw });
};
