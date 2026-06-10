/**
 * Content Parser v3 - 智能识别考试题型并生成卡片
 */
const Parser = {
  parse(text) {
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '  ').replace(/\n{3,}/g, '\n\n');
    let cards = [];
    cards = cards.concat(this.parseEntityGroups(text));
    cards = cards.concat(this.parseQuestionAnswer(text));
    if (cards.length === 0) cards = cards.concat(this.parseNumberedQA(text));
    cards = cards.concat(this.parseChoiceQuestions(text));
    const seen = new Set();
    cards = cards.filter(c => { const k = c.front.trim().substring(0, 50); if (seen.has(k)) return false; seen.add(k); return true; });
    return cards;
  },

  parseEntityGroups(text) {
    const cards = [];
    const lines = text.split('\n');
    const fieldLabels = ['思想','思想主张','主张','观点','影响','地位','评价','代表作','著作','作品','贡献','意义','特点','内容','方法','原则','理论','局限','不足','缺陷','背景','原因','目的','措施','方式','形式','类型','分类','概念','含义','定义','起源','发展','演变','名词解释地位','主要思想','学术思想','史学思想','史学观点','观点与影响','意义与影响','贡献与影响','影响与评价','政治思想'];
    const sectionHeaders = ['近代史学','世界近代史','世界史','中国史','西方史学史','史学概论','名词解释','简答题','论述题','选择题','填空题','问答题','重点','考点','复习','总结','概述','导论','绪论'];
    const descPatterns = /思想家|史学家|创始人|历史学家|哲学家|文学家|政治家|军事家|科学家|经济学家|学家|学者|先生/;

    function isEntityName(line) {
      var t = line.trim();
      if (t.length < 2 || t.length > 8) return false;
      if (/^[\d\s.、．()（）\-—]/.test(t)) return false;
      if (fieldLabels.includes(t)) return false;
      if (/[？?]/.test(t)) return false;
      if (/[。；！，,;：:、]$/.test(t)) return false;
      if (sectionHeaders.some(function(h) { return t.includes(h); })) return false;
      if (descPatterns.test(t)) return false;
      if (/^[以从在被把将]/.test(t)) return false;
      // 必须是纯中文名字（2-8字）或英文名
      if (!/^[\u4e00-\u9fa5·\u00b7]{2,8}$/.test(t) && !/^[A-Za-z\s·\-\.\']{2,20}$/.test(t)) return false;
      return true;
    }

    function isFieldLabel(line) {
      var t = line.trim();
      if (fieldLabels.includes(t)) return true;
      if (fieldLabels.some(function(l) { return t.startsWith(l + '：') || t.startsWith(l + ':'); })) return true;
      return false;
    }

    var currentEntity = null;
    var currentLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      // 问句处理
      if (line.length > 10 && /[？?]/.test(line)) {
        if (currentEntity && currentLines.length > 0) {
          var b = currentLines.join('\n');
          cards.push({front: currentEntity, back: b, type: b.length > 300 ? '论述题' : '简答题'});
          currentEntity = null;
          currentLines = [];
        }
        var answerLines = [];
        var j = i + 1;
        while (j < lines.length) {
          var nl = lines[j].trim();
          if (!nl) { j++; continue; }
          if (nl.length > 10 && /[？?]/.test(nl)) break;
          if (isEntityName(nl)) break;
          answerLines.push(nl);
          j++;
        }
        if (answerLines.length > 0) {
          var ab = answerLines.join('\n');
          cards.push({front: line, back: ab, type: ab.length > 200 ? '论述题' : '简答题'});
          i = j - 1;
        }
        continue;
      }

      // 新实体
      if (isEntityName(line) && !isFieldLabel(line)) {
        if (currentEntity && currentLines.length > 0) {
          var b2 = currentLines.join('\n');
          cards.push({front: currentEntity, back: b2, type: b2.length > 300 ? '论述题' : '简答题'});
        }
        currentEntity = line;
        currentLines = [];
        continue;
      }

      if (currentEntity) currentLines.push(line);
    }

    if (currentEntity && currentLines.length > 0) {
      var b3 = currentLines.join('\n');
      cards.push({front: currentEntity, back: b3, type: b3.length > 300 ? '论述题' : '简答题'});
    }

    return cards;
  },

  parseQuestionAnswer(text) {
    var cards = [];
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.length > 10 && /[？?]/.test(line)) {
        var answerLines = [];
        var j = i + 1;
        while (j < lines.length) {
          var nl = lines[j].trim();
          if (!nl) { j++; continue; }
          if (nl.length > 10 && /[？?]/.test(nl)) break;
          if (nl.length < 15 && nl.length > 2 && !/[。；！，,;：:]$/.test(nl)) break;
          answerLines.push(nl);
          j++;
        }
        if (answerLines.length > 0) {
          var back = answerLines.join('\n');
          cards.push({front: line, back: back, type: back.length > 200 ? '论述题' : '简答题'});
          i = j - 1;
        }
      }
    }
    return cards;
  },

  parseNumberedQA(text) {
    var cards = [];
    var re = /^(?:\s*(?:\d+[.、．)）]|[（(][一二三四五六七八九十\d]+[）)]|(?:一|二|三|四|五|六|七|八|九|十)[、.])).*/m;
    var sections = text.split(re);
    return cards;
  },

  parseChoiceQuestions(text) {
    var cards = [];
    return cards;
  },

  guessType(question, answer) {
    if (answer.length < 50) return '简答题';
    if (answer.length > 200) return '论述题';
    return '简答题';
  }
};