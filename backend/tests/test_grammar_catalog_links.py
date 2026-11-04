from app.services.grammar_catalog.catalog import get_rule_by_id


def test_yaml_rule_has_read_more_links():
    rule = get_rule_by_id("aller_infinitif")
    assert rule is not None
    assert rule.links
    assert rule.links[0]["url"].startswith("https://fr.wiktionary.org/")


def test_builtin_rules_default_to_no_links():
    rule = get_rule_by_id("imparfait")
    assert rule is not None
    assert rule.links == []
