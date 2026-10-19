import re
from typing import Dict, Any
from app.services.llm.base import LLMProvider
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
)


class MockLLMProvider(LLMProvider):
    """Deterministic offline mock provider for tests and local development."""

    @property
    def provider_name(self) -> str:
        return "mock"

    async def health_check(self) -> bool:
        return True

    async def evaluate_sentence(self, request: GrammarEvaluationRequest) -> GrammarEvaluationResult:
        sentence = request.user_sentence.strip()
        lower = sentence.lower()
        rule_id = request.target_rule_id.lower()

        # Rule 1: Futur proche (aller + infinitif)
        if "futur_proche" in rule_id or "aller" in rule_id:
            aller_forms = ["vais", "vas", "va", "allons", "allez", "vont"]
            has_aller = any(re.search(rf"\b{form}\b", lower) for form in aller_forms)

            # Check if there is an infinitive (-er, -ir, -re) following or near aller
            has_infinitive = bool(re.search(r"\b\w+(er|ir|re)\b", lower))

            if has_aller and has_infinitive:
                return GrammarEvaluationResult(
                    is_correct=True,
                    target_pattern_matched=True,
                    score=95,
                    status="correct",
                    positive_feedback="Excellent ! Vous avez bien utilisé le verbe aller conjugué suivi d'un infinitif.",
                    suggested_alternatives=[
                        sentence.rstrip(".") + " demain.",
                        sentence.rstrip(".") + " bientôt.",
                    ],
                )
            elif has_aller and not has_infinitive:
                return GrammarEvaluationResult(
                    is_correct=False,
                    target_pattern_matched=False,
                    score=50,
                    status="incorrect",
                    corrected_sentence=f"{sentence} faire quelque chose.",
                    error_explanation="Le futur proche nécessite le verbe 'aller' suivi d'un verbe à l'infinitif (ex: 'Je vais visiter').",
                    suggested_alternatives=["Je vais partir bientôt.", "Nous allons manger."],
                )
            else:
                return GrammarEvaluationResult(
                    is_correct=False,
                    target_pattern_matched=False,
                    score=30,
                    status="incorrect",
                    corrected_sentence="Je vais " + sentence.lower(),
                    error_explanation="La phrase ne contient pas de forme conjuguée du verbe 'aller' (vais, vas, va, allons, allez, vont).",
                    suggested_alternatives=["Je vais lire ce livre.", "Il va voyager à Paris."],
                )

        # Rule 2: Passé composé (avoir/être + participe passé)
        if "passe_compose" in rule_id or "participe" in rule_id:
            aux_forms = [
                "ai", "as", "a", "avons", "avez", "ont",
                "suis", "es", "est", "sommes", "êtes", "sont",
            ]
            has_aux = any(re.search(rf"\b{aux}\b", lower) for aux in aux_forms)
            has_participle = bool(re.search(r"\b\w+(é|i|u|t|s)\b", lower))

            if has_aux and has_participle:
                return GrammarEvaluationResult(
                    is_correct=True,
                    target_pattern_matched=True,
                    score=92,
                    status="correct",
                    positive_feedback="Très bien ! La structure de l'auxiliaire et du participe passé est respectée.",
                    suggested_alternatives=[sentence.rstrip(".") + " hier."],
                )
            return GrammarEvaluationResult(
                is_correct=False,
                target_pattern_matched=False,
                score=45,
                status="incorrect",
                corrected_sentence="J'ai terminé mon travail.",
                error_explanation="Le passé composé requiert un auxiliaire (avoir ou être) au présent suivi du participe passé.",
                suggested_alternatives=["J'ai vu ce film.", "Elle est allée au marché."],
            )

        # Rule 3: Négation (ne ... pas/jamais/rien/plus)
        if "negation" in rule_id:
            has_ne = bool(re.search(r"\b(ne|n')\b", lower))
            has_neg_word = bool(re.search(r"\b(pas|jamais|rien|plus|aucun|personne)\b", lower))

            if has_ne and has_neg_word:
                return GrammarEvaluationResult(
                    is_correct=True,
                    target_pattern_matched=True,
                    score=96,
                    status="correct",
                    positive_feedback="Bravo ! La double négation (ne ... pas/jamais/rien) est parfaitement encadrée.",
                    suggested_alternatives=[sentence],
                )
            return GrammarEvaluationResult(
                is_correct=False,
                target_pattern_matched=False,
                score=40,
                status="incorrect",
                corrected_sentence="Je ne sais pas.",
                error_explanation="En français standard, la négation encadre le verbe avec 'ne' (ou 'n\'') et un mot négatif ('pas', 'jamais', etc.).",
                suggested_alternatives=["Je ne mange pas de viande.", "Il ne vient jamais en retard."],
            )

        # Default fallback for any other grammar rule
        words = lower.split()
        if len(words) >= 3:
            return GrammarEvaluationResult(
                is_correct=True,
                target_pattern_matched=True,
                score=85,
                status="correct",
                positive_feedback="Phrase bien formulée et compréhensible.",
                suggested_alternatives=[sentence],
            )
        return GrammarEvaluationResult(
            is_correct=False,
            target_pattern_matched=False,
            score=40,
            status="incorrect",
            error_explanation="La phrase semble trop courte ou incomplète pour analyser la structure demandée.",
            suggested_alternatives=["Veuillez formuler une phrase complète."],
        )

    async def explain_grammar_point(self, request: GrammarExplanationRequest) -> GrammarExplanationResult:
        rule_id = request.rule_id.lower()

        if "futur_proche" in rule_id or "aller" in rule_id:
            return GrammarExplanationResult(
                rule_id=request.rule_id,
                rule_name="Futur proche",
                summary="Le futur proche exprime une action imminente ou déjà planifiée dans un avenir proche.",
                formula="Sujet + aller (au présent) + Verbe à l'infinitif",
                key_rules=[
                    "Seul le verbe 'aller' se conjugue au présent de l'indicatif.",
                    "Le verbe principal reste toujours à l'infinitif.",
                    "À la forme négative, 'ne... pas' encadre seulement le verbe 'aller' (ex: Je ne vais pas partir).",
                ],
                common_mistakes=[
                    "Oublier de conjuguer aller : *'Je aller manger' -> 'Je vais manger'",
                    "Conjuguer les deux verbes : *'Je vais mange' -> 'Je vais manger'",
                ],
                conjugation_or_forms={
                    "je": "vais + infinitif",
                    "tu": "vas + infinitif",
                    "il/elle/on": "va + infinitif",
                    "nous": "allons + infinitif",
                    "vous": "allez + infinitif",
                    "ils/elles": "vont + infinitif",
                },
                examples=[
                    "Je vais lire ce livre ce soir.",
                    "Nous allons visiter le musée demain.",
                    "Qu'est-ce que tu vas faire ?",
                ],
            )

        if "passe_compose" in rule_id:
            return GrammarExplanationResult(
                rule_id=request.rule_id,
                rule_name="Passé composé",
                summary="Le passé composé exprime une action ponctuelle et terminée dans le passé.",
                formula="Sujet + auxiliaire (avoir ou être) + participe passé",
                key_rules=[
                    "La majorité des verbes utilisent l'auxiliaire 'avoir'.",
                    "Les verbes de mouvement (DR & MRS VANDERTRAMP) et les verbes pronominaux utilisent 'être'.",
                    "Avec 'être', le participe passé s'accorde en genre et en nombre avec le sujet.",
                ],
                common_mistakes=[
                    "Mauvais auxiliaire : *'J'ai allé' -> 'Je suis allé(e)'",
                    "Oubli de l'accord avec être : *'Elles sont parti' -> 'Elles sont parties'",
                ],
                conjugation_or_forms={
                    "avoir": "ai, as, a, avons, avez, ont",
                    "être": "suis, es, est, sommes, êtes, sont",
                },
                examples=[
                    "J'ai fini mon livre.",
                    "Elle est partie tôt ce matin.",
                    "Nous avons mangé ensemble.",
                ],
            )

        return GrammarExplanationResult(
            rule_id=request.rule_id,
            rule_name=request.rule_name,
            summary=f"Règle grammaticale pour {request.rule_name}.",
            formula="Structure grammaticale correspondante",
            key_rules=["Respecter la concordance et l'accord des mots."],
            common_mistakes=["Attention aux exceptions courantes."],
            conjugation_or_forms={},
            examples=[f"Exemple d'utilisation de {request.rule_name}."],
        )
