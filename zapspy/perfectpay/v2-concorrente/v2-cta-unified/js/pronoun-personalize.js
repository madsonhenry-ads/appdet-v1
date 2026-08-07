(function() {
    if (window.__zsPronounLoaded) return;
    window.__zsPronounLoaded = true;

    var lang = (document.documentElement.lang || 'en').substring(0, 2).toLowerCase();
    var gender = '';
    try { gender = (localStorage.getItem('targetGender') || '').toLowerCase(); } catch(e) {}
    if (!gender) return;

    // gender semantics:
    //   "male"   -> the USER is male, so the TARGET is a woman -> she/her
    //   "female" -> the USER is female, so the TARGET is a man  -> he/his
    //   "other"  -> ambiguous, fall back to neutral
    var targetIsFemale = gender === 'male';
    var targetIsMale   = gender === 'female';
    if (!targetIsFemale && !targetIsMale) return;

    // Translation tables for pronouns by language.
    // Each value is [she_form, he_form] selected by targetIsFemale.
    var dict = {
        en: {
            they: ['she', 'he'], them: ['her', 'him'], their: ['her', 'his'], theyre: ['she\'s', 'he\'s'],
            They: ['She', 'He'], Them: ['Her', 'Him'], Their: ['Her', 'His'], Theyre: ['She\'s', 'He\'s'],
            person: ['her', 'him'], person_cap: ['Her', 'Him']
        },
        es: {
            they: ['ella', 'él'], them: ['ella', 'él'], their: ['su', 'su'], theyre: ['ella está', 'él está'],
            They: ['Ella', 'Él'], Them: ['Ella', 'Él'], Their: ['Su', 'Su'], Theyre: ['Ella está', 'Él está'],
            person: ['ella', 'él'], person_cap: ['Ella', 'Él']
        },
        pt: {
            they: ['ela', 'ele'], them: ['ela', 'ele'], their: ['dela', 'dele'], theyre: ['ela está', 'ele está'],
            They: ['Ela', 'Ele'], Them: ['Ela', 'Ele'], Their: ['Dela', 'Dele'], Theyre: ['Ela está', 'Ele está'],
            person: ['ela', 'ele'], person_cap: ['Ela', 'Ele']
        },
        fr: {
            they: ['elle', 'il'], them: ['elle', 'lui'], their: ['son', 'son'], theyre: ['elle est', 'il est'],
            They: ['Elle', 'Il'], Them: ['Elle', 'Lui'], Their: ['Son', 'Son'], Theyre: ['Elle est', 'Il est'],
            person: ['elle', 'lui'], person_cap: ['Elle', 'Lui']
        }
    };
    var d = dict[lang] || dict.en;
    var idx = targetIsFemale ? 0 : 1;

    function pick(key) { return (d[key] && d[key][idx]) || ''; }

    function apply() {
        var nodes = document.querySelectorAll('[data-pronoun]');
        nodes.forEach(function(el) {
            var key = el.getAttribute('data-pronoun');
            var v = pick(key);
            if (v) el.textContent = v;
        });
        document.body.setAttribute('data-target-gender', targetIsFemale ? 'female' : 'male');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }
})();
