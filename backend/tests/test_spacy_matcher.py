import pytest
from app.services.spacy_engine.engine import FrenchGrammarEngine, get_grammar_engine
from app.services.grammar_catalog.catalog import list_all_rules, get_rule_by_id


@pytest.fixture(scope="module")
def engine():
    return get_grammar_engine()


def test_grammar_catalog_completeness():
    rules = list_all_rules()
    assert len(rules) >= 7

    rule_ids = {r.id for r in rules}
    expected = {
        "futur_proche",
        "passe_compose",
        "imparfait",
        "negation",
        "pronoms_cod_coi",
        "conditionnel_present",
        "subjonctif_present",
    }
    assert expected.issubset(rule_ids)

    rule = get_rule_by_id("futur_proche")
    assert rule is not None
    assert "aller" in rule.formula.lower()


def test_futur_proche_matcher_positive(engine: FrenchGrammarEngine):
    sentences = [
        "Je vais visiter mon ami ce week-end.",
        "Nous allons bientôt partir pour Paris.",
        "Elle va faire ses devoirs.",
        "Qu'est-ce que vous allez manger ce soir ?",
    ]
    for s in sentences:
        matched, details = engine.check_target_rule(s, "futur_proche")
        assert matched is True, f"Failed to match futur proche in: {s}"
        assert details is not None
        assert "aller" in details.notes.lower()


def test_futur_proche_matcher_negative(engine: FrenchGrammarEngine):
    sentences = [
        "Je vais à l'école tous les matins.",  # aller + preposition (no infinitive)
        "Nous allons au cinéma ce soir.",
        "Je visite mon ami ce week-end.",
    ]
    for s in sentences:
        matched, _ = engine.check_target_rule(s, "futur_proche")
        assert matched is False, f"False positive in: {s}"


def test_passe_compose_matcher_positive(engine: FrenchGrammarEngine):
    sentences = [
        "J'ai fini la lecture de ce roman passionnant.",
        "Elle est allée à la gare ce matin.",
        "Nous avons bien mangé hier soir.",
        "Ils sont partis très tôt.",
    ]
    for s in sentences:
        matched, details = engine.check_target_rule(s, "passe_compose")
        assert matched is True, f"Failed to match passé composé in: {s}"
        assert details is not None


def test_imparfait_matcher_positive(engine: FrenchGrammarEngine):
    sentences = [
        "Quand j'étais jeune, je marchais des heures dans la forêt.",
        "Il faisait très froid ce jour-là.",
        "Nous habitions dans une maison au bord du lac.",
    ]
    for s in sentences:
        matched, details = engine.check_target_rule(s, "imparfait")
        assert matched is True, f"Failed to match imparfait in: {s}"


def test_negation_matcher_positive(engine: FrenchGrammarEngine):
    sentences = [
        "Je ne comprends pas cette règle.",
        "Il n'a jamais voyagé en avion.",
        "Elle ne dit rien du tout.",
        "Nous ne voulons plus attendre.",
    ]
    for s in sentences:
        matched, details = engine.check_target_rule(s, "negation")
        assert matched is True, f"Failed to match negation in: {s}"


def test_pronoms_cod_coi_matcher_positive(engine: FrenchGrammarEngine):
    sentences = [
        "Je le vois tous les matins à l'arrêt de bus.",
        "Elle lui donne un bon conseil.",
        "Nous en voulons trois s'il vous plaît.",
        "J'y vais dès demain matin.",
    ]
    for s in sentences:
        matched, details = engine.check_target_rule(s, "pronoms_cod_coi")
        assert matched is True, f"Failed to match object pronoun in: {s}"


def test_pronoms_cod_coi_distinction_from_article(engine: FrenchGrammarEngine):
    # 'le' here is an article before 'livre', not an object pronoun before a verb
    sentence = "Le livre est posé sur la grande table."
    matched, _ = engine.check_target_rule(sentence, "pronoms_cod_coi")
    assert matched is False


def test_conditionnel_matcher_positive(engine: FrenchGrammarEngine):
    sentences = [
        "Je voudrais commander une tasse de café.",
        "Nous pourrions partir un peu plus tôt.",
        "Tu devrais lire ce passage.",
    ]
    for s in sentences:
        matched, details = engine.check_target_rule(s, "conditionnel_present")
        assert matched is True, f"Failed to match conditionnel in: {s}"


def test_subjonctif_matcher_positive(engine: FrenchGrammarEngine):
    sentences = [
        "Il faut que tu fasses attention.",
        "Bien qu'il soit fatigué, il poursuit son travail.",
        "Je souhaite que vous réussissiez votre projet.",
    ]
    for s in sentences:
        matched, details = engine.check_target_rule(s, "subjonctif_present")
        assert matched is True, f"Failed to match subjonctif in: {s}"


def test_multiple_rules_in_sentence(engine: FrenchGrammarEngine):
    sentence = "Je ne vais pas partir demain."
    analysis = engine.analyze_sentence(sentence)
    assert "futur_proche" in analysis.matched_rule_ids
    assert "negation" in analysis.matched_rule_ids
    assert len(analysis.matches) >= 2


def test_sentence_segmenter(engine: FrenchGrammarEngine):
    paragraph = (
        "Bonjour à tous. Aujourd'hui, nous allons étudier la grammaire française. "
        "Avez-vous lu le chapitre 3 ? M. Dupont nous a dit de le faire."
    )
    sents = engine.segment_into_sentences(paragraph)
    assert len(sents) == 4
    assert sents[0] == "Bonjour à tous."
    assert "aujourd'hui" in sents[1].lower()
