const CARDS=[
{id:1,era:"先秦",type:"概念",q:"分封制",a:"西周实行的政治制度。周天子将土地和人民分封给王族、功臣和先代贵族，建立诸侯国。诸侯对周天子有镇守疆土、随从作战、交纳贡赋等义务。"},
{id:2,era:"先秦",type:"概念",q:"宗法制",a:"按照血缘宗族关系分配政治权力的制度。核心是嫡长子继承制，形成"周天子—诸侯—卿大夫—士"的等级结构。与分封制互为表里。"},
{id:3,era:"先秦",type:"事件",q:"商鞅变法",a:"公元前356年秦孝公任用商鞅推行的改革。废井田开阡陌、奖励军功、推行县制、统一度量衡。使秦国迅速强大。"},
{id:4,era:"先秦",type:"人物",q:"孔子",a:"儒家学派创始人。核心思想为"仁"和"礼"，主张"为政以德"。开创私学，有教无类。编订六经。"},
{id:5,era:"先秦",type:"概念",q:"百家争鸣",a:"春秋战国时期学术思想繁荣的局面。儒家主张仁政、道家主张无为、法家主张法治、墨家主张兼爱非攻。"},
{id:6,era:"秦汉",type:"概念",q:"皇帝制度",a:"秦始皇创立。皇帝总揽一切军政大权，拥有至高无上的地位。确立了皇位世袭制度，延续两千余年。"},
{id:7,era:"秦汉",type:"概念",q:"郡县制",a:"秦朝全面推行的地方行政制度。郡下设县，长官由中央直接任免，不得世袭。加强了中央集权。"},
{id:8,era:"秦汉",type:"事件",q:"焚书坑儒",a:"秦始皇为统一思想，焚烧民间收藏的诸子百家典籍，后又坑杀非议朝政的方士儒生。造成文化浩劫。"},
{id:9,era:"秦汉",type:"人物",q:"汉武帝",a:"西汉最有作为的皇帝。政治上颁布推恩令削弱诸侯，思想上罢黜百家独尊儒术，经济上盐铁官营，军事上北击匈奴。"},
{id:10,era:"秦汉",type:"概念",q:"推恩令",a:"汉武帝采纳主父偃建议颁布。规定诸侯王死后，其余子弟也可分割部分封地为列侯。名义上是施恩，实际上削弱了诸侯国势力。"},
{id:11,era:"秦汉",type:"概念",q:"丝绸之路",a:"张骞出使西域后开辟的商贸路线。从长安出发经河西走廊、西域到达中亚、西亚乃至欧洲。促进了中外经济文化交流。"},
{id:12,era:"秦汉",type:"概念",q:"察举制",a:"汉代选官制度。由地方长官在辖区内考察、选取人才并推荐给中央。主要科目为孝廉和茂才。"},
{id:13,era:"魏晋南北朝",type:"概念",q:"九品中正制",a:"魏晋时期的选官制度。设置中正官评定人才为九品。后期被世家大族垄断，形成"上品无寒门，下品无世族"的局面。"},
{id:14,era:"魏晋南北朝",type:"事件",q:"孝文帝改革",a:"北魏孝文帝推行的汉化改革。迁都洛阳，改汉姓、穿汉服、说汉语、与汉族通婚。促进了北方民族大融合。"},
{id:15,era:"魏晋南北朝",type:"概念",q:"江南经济开发",a:"由于北方战乱，大量人口南迁，带去了先进的生产技术和劳动力。南方得到大规模开发，经济重心开始南移。"},
{id:16,era:"隋唐",type:"概念",q:"科举制",a:"隋朝创立、唐朝完善的选官制度。通过分科考试选拔人才，打破了门阀士族对仕途的垄断。延续一千三百余年。"},
{id:17,era:"隋唐",type:"概念",q:"三省六部制",a:"唐朝中央行政体制。中书省草拟诏令、门下省审核封驳、尚书省执行政令。尚书省下设吏户礼兵刑工六部。"},
{id:18,era:"隋唐",type:"概念",q:"贞观之治",a:"唐太宗李世民在位时期（627-649年）。吸取隋亡教训，知人善任、虚怀纳谏。政治清明，经济发展，为大唐盛世奠定基础。"},
{id:19,era:"隋唐",type:"事件",q:"安史之乱",a:"755-763年安禄山、史思明发动的叛乱。唐朝由盛转衰的转折点。此后藩镇割据、宦官专权不断。"},
{id:20,era:"隋唐",type:"概念",q:"两税法",a:"唐德宗时杨炎推行的赋税改革。每户按资产交纳户税，按田亩交纳地税，分夏秋两季征收。改变了以人丁为主的征税标准。"},
{id:21,era:"宋",type:"概念",q:"二府三司制",a:"宋代中央行政体制。中书门下为最高行政机构，枢密院掌军权，三司掌财权。分割了宰相权力，加强了皇权。"},
{id:22,era:"宋",type:"概念",q:"程朱理学",a:"以程颢、程颐和朱熹为代表的新儒学。核心主张"存天理，灭人欲"，强调格物致知。成为后世官方正统哲学。"},
{id:23,era:"宋",type:"概念",q:"重文轻武政策",a:"宋太祖确立的治国方针。大力抬高文人地位，扩大科举取士名额，抑制武将权力。扭转了藩镇割据局面，但也导致军事积弱。"},
{id:24,era:"宋",type:"概念",q:"经济重心南移完成",a:"南宋时期经济重心完成南移。南方农业、手工业和商业全面超过北方。"},
{id:25,era:"元",type:"概念",q:"行省制",a:"元朝地方行政制度。中央设中书省，地方设行中书省。行省长官由中央任命。是中国省制的开端，影响至今。"},
{id:26,era:"明",type:"事件",q:"废丞相",a:"明太祖朱元璋借胡惟庸案废除丞相制度，将权力分归六部，六部直接对皇帝负责。皇权空前加强。"},
{id:27,era:"明",type:"事件",q:"郑和下西洋",a:"1405-1433年郑和七次远航。船队规模庞大，最远到达非洲东海岸和红海沿岸。比欧洲大航海早了近一个世纪。"},
{id:28,era:"明",type:"事件",q:"一条鞭法",a:"张居正推行的赋税改革。将田赋、徭役、杂税合并为一条，折银征收。简化了税制，促进了商品经济发展。"},
{id:29,era:"清",type:"概念",q:"军机处",a:"雍正帝设立的中枢机构。军机大臣由皇帝钦定，只能跪奏笔录，完全秉承皇帝旨意办事。标志着君主专制达到顶峰。"},
{id:30,era:"清",type:"事件",q:"康乾盛世",a:"清朝康熙、雍正、乾隆三朝的繁荣期。疆域辽阔、人口增长、经济繁荣。但后期出现闭关锁国、吏治腐败等问题。"},
{id:31,era:"近代",type:"事件",q:"鸦片战争",a:"1840-1842年英国发动的侵华战争。清政府战败，签订《南京条约》。割让香港岛、赔款2100万银元。中国开始沦为半殖民地半封建社会。"},
{id:32,era:"近代",type:"事件",q:"太平天国运动",a:"1851-1864年洪秀全领导的农民起义。定都天京（南京），颁布《天朝田亩制度》。沉重打击了清朝统治。"},
{id:33,era:"近代",type:"事件",q:"洋务运动",a:"19世纪60-90年代，以"自强""求富"为口号。创办军事工业和民用工业，建立新式海陆军。是中国近代化的开端。"},
{id:34,era:"近代",type:"事件",q:"甲午战争",a:"1894-1895年中日战争。北洋水师全军覆没。签订《马关条约》：割让台湾及澎湖列岛、赔款二亿两白银。"},
{id:35,era:"近代",type:"事件",q:"戊戌变法",a:"1898年康有为、梁启超等推动的维新运动。光绪帝颁布变法诏令。慈禧太后发动政变，变法仅持续103天即失败。"},
{id:36,era:"近代",type:"事件",q:"辛亥革命",a:"1911年爆发的资产阶级民主革命。推翻了清朝统治，结束了两千多年的君主专制制度。建立了中华民国。"},
{id:37,era:"近代",type:"事件",q:"五四运动",a:"1919年因巴黎和会中国外交失败引发的爱国运动。口号"外争主权，内除国贼"。是新民主主义革命的开端。"},
{id:38,era:"世界古代",type:"概念",q:"雅典民主政治",a:"古希腊雅典城邦实行的民主制度。伯里克利时期达到鼎盛，公民大会是最高权力机构。开创了民主政治的先河。"},
{id:39,era:"世界古代",type:"概念",q:"罗马法",a:"从《十二铜表法》到《查士丁尼民法大全》的法律体系。确立了私有财产神圣不可侵犯等原则。对近代欧美法律产生了深远影响。"},
{id:40,era:"世界近代",type:"事件",q:"英国资产阶级革命",a:"1640-1688年英国推翻封建专制的革命。通过《权利法案》确立了议会主权和君主立宪制。"},
{id:41,era:"世界近代",type:"事件",q:"法国大革命",a:"1789年爆发。攻占巴士底狱，颁布《人权宣言》。摧毁了封建等级制度，传播了自由民主的进步思想。"},
{id:42,era:"世界近代",type:"事件",q:"工业革命",a:"18世纪60年代始于英国的技术革命。以蒸汽机的改良为标志，机器生产取代手工劳动。极大提高了生产力。"},
{id:43,era:"世界近代",type:"事件",q:"马克思主义诞生",a:"1848年《共产党宣言》发表。马克思和恩格斯创立了科学社会主义理论。"},
{id:44,era:"世界现代",type:"事件",q:"十月革命",a:"1917年列宁领导的布尔什维克革命。推翻了资产阶级临时政府，建立了世界上第一个社会主义国家。"},
{id:45,era:"世界现代",type:"事件",q:"罗斯福新政",a:"1933年罗斯福为应对大萧条推行的改革。加强国家对经济的干预和调节，推行以工代赈、建立社会保障体系。"},
{id:46,era:"世界现代",type:"事件",q:"第二次世界大战",a:"1939-1945年。法西斯轴心国与同盟国之间的全球战争。最终以反法西斯同盟胜利告终。战后建立了联合国。"}
];
const ERAS=[...new Set(CARDS.map(c=>c.era))];
const LS='flashcards-v1';
const LS_STREAK='flashcards-streak';
function load(){try{return JSON.parse(localStorage.getItem(LS))||{}}catch(e){return{}}}
function save(d){localStorage.setItem(LS,JSON.stringify(d))}
function getStreak(){try{return parseInt(localStorage.getItem(LS_STREAK))||0}catch(e){return 0}}
function setStreak(n){localStorage.setItem(LS_STREAK,n)}
function getSRS(id){var d=load();return d[id]||{ease:2.5,interval:0,reps:0,next:0,last:0,status:'new'}}
function putSRS(id,s){var d=load();d[id]=s;save(d)}
function review(id,rating){
  var s=getSRS(id);var now=Date.now();
  if(rating===0){s.reps=0;s.interval=1/60;s.ease=Math.max(1.3,s.ease-0.2);s.status='learning'}
  else if(rating===1){s.interval=Math.max(1/60,s.interval*1.2);s.ease=Math.max(1.3,s.ease-0.15);s.reps++;s.status='learning'}
  else if(rating===2){
    if(s.reps===0)s.interval=1;
    else if(s.reps===1)s.interval=6;
    else s.interval=Math.round(s.interval*s.ease);
    s.ease=Math.max(1.3,s.ease+0.0);s.reps++;s.status=s.interval>21?'mature':'review';
  }else{
    if(s.reps===0)s.interval=4;
    else s.interval=Math.round(s.interval*s.ease*1.3);
    s.ease=Math.max(1.3,s.ease+0.15);s.reps++;s.status=s.interval>21?'mature':'review';
  }
  s.last=now;s.next=now+s.interval*60*1000;putSRS(id,s);
  if(rating===0){setStreak(0)}else{setStreak(getStreak()+1)}
}
function dueCards(){var now=Date.now();return CARDS.filter(c=>{var s=getSRS(c.id);return!s.next||s.next<=now})}
function mastery(id){var s=getSRS(id);return s.status||'new'}
var view='review',filterEra='all',searchQ='',reviewIdx=0,reviewQ=[],cardFlipped=false;
function switchView(v){
  view=v;document.querySelectorAll('.nav-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  ['viewReview','viewBrowse','viewProgress','viewAchievements'].forEach(id=>{
    document.getElementById(id).style.display='none';
  });
  if(v==='review')document.getElementById('viewReview').style.display='';
  else if(v==='browse')document.getElementById('viewBrowse').style.display='';
  else if(v==='progress')document.getElementById('viewProgress').style.display='';
  else document.getElementById('viewAchievements').style.display='';
  renderCurrentView();
}
function renderCurrentView(){
  if(view==='review')renderReview();
  else if(view==='browse')renderBrowse();
  else if(view==='progress')renderProgress();
  else renderAchievements();
}
function renderReview(){
  var el=document.getElementById('viewReview');
  var due=dueCards();
  if(due.length===0){
    var total=CARDS.length,reviewed=0;
    CARDS.forEach(c=>{var s=getSRS(c.id);if(s.reps>0)reviewed++});
    el.innerHTML='<div class="review-empty"><div class="icon">&#x2728;</div><p>今日复习已完成！</p><p style="margin-top:8px;font-size:.82rem">已掌握 '+reviewed+'/'+total+' 张卡片</p><button onclick="resetAll()" style="margin-top:20px;padding:8px 20px;border:1px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;border-radius:8px;font-size:.82rem">重置所有进度</button></div>';
    return;
  }
  reviewQ=due.sort(()=>Math.random()-0.5);reviewIdx=0;cardFlipped=false;
  renderReviewCard();
}
function renderReviewCard(){
  var el=document.getElementById('viewReview');
  if(reviewIdx>=reviewQ.length){renderReview();return;}
  var c=reviewQ[reviewIdx];var s=getSRS(c.id);
  var stats=calcStats();
  el.innerHTML=
    '<div class="stats-row">'+
    '<div class="sr"><div class="num">'+stats.due+'</div><div class="lbl">待复习</div></div>'+
    '<div class="sr"><div class="num">'+stats.learned+'</div><div class="lbl">已掌握</div></div>'+
    '<div class="sr"><div class="num">'+stats.total+'</div><div class="lbl">总卡片</div></div>'+
    '</div>'+
    (stats.streak>0?'<div class="streak"><span>&#x1F525;</span> 连续答对 '+stats.streak+' 张</div>':'')+
    '<div class="flashcard-wrap"><div class="flashcard'+(cardFlipped?' flipped':'')+'" onclick="flipCard()">'+
    '<div class="flashcard-face flashcard-front">'+
    '<div class="fc-era">'+c.era+'</div>'+
    '<div class="fc-type">'+c.type+'</div>'+
    '<div class="fc-q">'+c.q+'</div>'+
    '<div class="fc-hint">点击翻转查看答案</div>'+
    '</div>'+
    '<div class="flashcard-face flashcard-back">'+
    '<div class="back-title">'+c.q+'</div>'+
    '<div class="back-era">'+c.era+' · '+c.type+'</div>'+
    '<div class="back-body">'+c.a+'</div>'+
    '</div></div></div>'+
    (cardFlipped?
      '<div class="rating-bar">'+
      '<button class="rate-btn again" onclick="rateCard(0)">忘了<span class="rate-lbl">&lt;1分钟</span></button>'+
      '<button class="rate-btn hard" onclick="rateCard(1)">模糊<span class="rate-lbl">'+fmtInterval(s.interval*1.2)+'</span></button>'+
      '<button class="rate-btn good" onclick="rateCard(2)">记得<span class="rate-lbl">'+fmtInterval(nextGood(s))+'</span></button>'+
      '<button class="rate-btn easy" onclick="rateCard(3)">简单<span class="rate-lbl">'+fmtInterval(nextEasy(s))+'</span></button>'+
      '</div>':'<p class="review-info">第 '+(reviewIdx+1)+' / '+reviewQ.length+' 张</p>');
}
function flipCard(){cardFlipped=!cardFlipped;renderReviewCard()}
function rateCard(r){var c=reviewQ[reviewIdx];review(c.id,r);reviewIdx++;cardFlipped=false;renderReviewCard()}
function nextGood(s){if(s.reps===0)return 1;if(s.reps===1)return 6;return Math.round(s.interval*s.ease)}
function nextEasy(s){if(s.reps===0)return 4;return Math.round(s.interval*s.ease*1.3)}
function fmtInterval(mins){
  if(mins<1)return Math.round(mins*60)+'秒';
  if(mins<60)return Math.round(mins)+'分钟';
  if(mins<1440)return Math.round(mins/60)+'小时';
  return Math.round(mins/1440)+'天';
}
function calcStats(){
  var due=dueCards().length,learned=0,total=CARDS.length;
  var d=load();
  CARDS.forEach(c=>{if(d[c.id]&&d[c.id].reps>0)learned++});
  return{due,learned,total,streak:getStreak()};
}
function renderBrowse(){
  var el=document.getElementById('viewBrowse');
  var pills='<button class="pill'+(filterEra==='all'?' active':'')+'" onclick="setEra(\'all\')">全部</button>';
  ERAS.forEach(e=>{pills+='<button class="pill'+(filterEra===e?' active':'')+'" onclick="setEra(\''+e+'\')">'+e+'</button>'});
  var filtered=CARDS.filter(c=>{
    if(filterEra!=='all'&&c.era!==filterEra)return false;
    if(searchQ){var q=searchQ.toLowerCase();return c.q.toLowerCase().includes(q)||c.a.toLowerCase().includes(q)||c.era.includes(q)}
    return true;
  });
  var grid=filtered.map(c=>{
    var m=mastery(c.id);var mc=m==='new'?'m-new':m==='learning'?'m-learning':m==='review'?'m-review':'m-mature';
    return'<div class="grid-card" onclick="startReviewSingle('+c.id+')"><div class="gc-mastery '+mc+'"></div><div><span class="gc-era">'+c.era+'</span><span class="gc-type">'+c.type+'</span></div><div class="gc-title">'+c.q+'</div><div class="gc-preview">'+c.a+'</div></div>';
  }).join('');
  el.innerHTML='<div class="toolbar"><div class="filter-pills">'+pills+'</div><input class="s-input" placeholder="搜索卡片…" value="'+searchQ+'" oninput="searchQ=this.value;renderBrowse()"></div><div class="card-grid">'+grid+'</div>';
}
function setEra(e){filterEra=e;renderBrowse()}
function startReviewSingle(id){
  var c=CARDS.find(x=>x.id===id);if(!c)return;
  reviewQ=[c];reviewIdx=0;cardFlipped=false;switchView('review');
}
function renderProgress(){
  var el=document.getElementById('viewProgress');var stats=calcStats();var pct=stats.total>0?Math.round(stats.learned/stats.total*100):0;
  var byEra=ERAS.map(e=>{var total=CARDS.filter(c=>c.era===e).length;var learned=CARDS.filter(c=>{if(c.era!==e)return false;var s=getSRS(c.id);return s.reps>0}).length;return{era:e,total,learned}});
  var eraHTML=byEra.map(e=>'<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px"><span>'+e.era+'</span><span style="color:var(--text-faint)">'+e.learned+'/'+e.total+'</span></div><div class="prog-wrap"><div class="prog-fill" style="width:'+(e.total>0?Math.round(e.learned/e.total*100):0)+'%"></div></div></div>').join('');
  el.innerHTML='<div class="stats-row"><div class="sr"><div class="num">'+stats.total+'</div><div class="lbl">总卡片</div></div><div class="sr"><div class="num">'+stats.learned+'</div><div class="lbl">已掌握</div></div><div class="sr"><div class="num">'+stats.due+'</div><div class="lbl">待复习</div></div><div class="sr"><div class="num">'+pct+'%</div><div class="lbl">完成度</div></div></div><h3 style="font-family:var(--font);font-size:.88rem;color:var(--text-muted);margin-bottom:16px;letter-spacing:2px">按朝代统计</h3>'+eraHTML;
}
var ACHS=[
  {id:'first',icon:'&#x1F3AF;',name:'初次记忆',desc:'完成第一张卡片复习',check:function(){var d=load();return Object.values(d).some(s=>s.reps>0)}},
  {id:'ten',icon:'&#x1F4AF;',name:'十步芳草',desc:'掌握10张卡片',check:function(){var d=load();return Object.values(d).filter(s=>s.reps>0).length>=10}},
  {id:'twenty',icon:'&#x1F525;',name:'学富五车',desc:'掌握20张卡片',check:function(){var d=load();return Object.values(d).filter(s=>s.reps>0).length>=20}},
  {id:'all',icon:'&#x1F451;',name:'博古通今',desc:'掌握全部卡片',check:function(){var d=load();return Object.values(d).filter(s=>s.reps>0).length>=CARDS.length}},
  {id:'streak5',icon:'&#x26A1;',name:'过目不忘',desc:'连续答对5张不重置',check:function(){var stats=calcStats();return stats.streak>=5}},
  {id:'streak10',icon:'&#x1F31F;',name:'记忆大师',desc:'连续答对10张不重置',check:function(){var stats=calcStats();return stats.streak>=10}},
  {id:'world',icon:'&#x1F30D;',name:'放眼世界',desc:'掌握所有世界史卡片',check:function(){var d=load();return CARDS.filter(c=>c.era.includes('世界')).every(c=>d[c.id]&&d[c.id].reps>0)}},
  {id:'ancient',icon:'&#x1F3DB;',name:'上古通神',desc:'掌握所有先秦和秦汉卡片',check:function(){var d=load();return CARDS.filter(c=>c.era==='先秦'||c.era==='秦汉').every(c=>d[c.id]&&d[c.id].reps>0)}}
];
function renderAchievements(){
  var el=document.getElementById('viewAchievements');
  var html=ACHS.map(a=>{var ok=a.check();return'<div class="ach '+(ok?'unlocked':'locked')+'"><div class="ach-icon">'+a.icon+'</div><div class="ach-name">'+a.name+'</div><div class="ach-desc">'+a.desc+'</div></div>'}).join('');
  el.innerHTML='<h2 style="font-family:var(--font);font-size:1.2rem;margin-bottom:20px;letter-spacing:2px">成就墙</h2><div class="ach-grid">'+html+'</div>';
}
function resetAll(){if(confirm('确定要重置所有学习进度吗？')){localStorage.removeItem(LS);localStorage.removeItem(LS_STREAK);renderCurrentView()}}
document.querySelectorAll('.nav-tab').forEach(t=>{t.addEventListener('click',function(){switchView(this.dataset.view)})});
document.addEventListener('keydown',function(e){
  if(view!=='review'||reviewQ.length===0)return;
  if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!cardFlipped)flipCard()}
  if(cardFlipped){
    if(e.key==='1')rateCard(0);
    if(e.key==='2')rateCard(1);
    if(e.key==='3')rateCard(2);
    if(e.key==='4')rateCard(3);
  }
});
renderReview();