import re
from typing import Dict, Any
from app.services.llm.base import LLMProvider
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
)
from app.services.spacy_engine.diff import compute_sentence_diff


class MockLLMProvider(LLMProvider):
    """Deterministic offline mock provider with Vietnamese pedagogical explanations."""

    @property
    def provider_name(self) -> str:
        return "mock"

    async def health_check(self) -> bool:
        return True

    async def evaluate_sentence(self, request: GrammarEvaluationRequest) -> GrammarEvaluationResult:
        sentence = request.user_sentence.strip()
        lower = sentence.lower()
        rule_id = request.target_rule_id.lower()
        is_vi = request.learner_native_lang.lower() == "vi"

        # 1. Futur proche (aller + infinitif)
        if "futur_proche" in rule_id or "aller" in rule_id:
            aller_forms = ["vais", "vas", "va", "allons", "allez", "vont"]
            has_aller = any(re.search(rf"\b{form}\b", lower) for form in aller_forms)
            has_infinitive = bool(re.search(r"\b\w+(er|ir|re)\b", lower))

            # Detect common error: conjugated verb after aller: "Je vais mange"
            has_double_conjugation = bool(re.search(r"\bvais\s+mange\b", lower))

            if has_double_conjugation:
                corrected = sentence.replace("mange", "manger").replace("Mange", "manger")
                return GrammarEvaluationResult(
                    is_correct=False,
                    target_pattern_matched=True,
                    score=65,
                    status="minor_issues",
                    corrected_sentence=corrected,
                    error_explanation=(
                        "Sau động từ 'aller' ở hiện tại, động từ chính đi kèm PHẢI giữ ở dạng nguyên mẫu (infinitif): dùng 'manger', không dùng 'mange'."
                        if is_vi
                        else "Après le verbe 'aller', le verbe principal doit impérativement rester à l'infinitif."
                    ),
                    positive_feedback="Bạn đã dùng đúng trợ động từ 'aller'.",
                    suggested_alternatives=[corrected, "Je vais prendre une pomme."],
                    diff_tokens=compute_sentence_diff(sentence, corrected),
                    rule_id=request.target_rule_id,
                    rule_name=request.target_rule_name,
                    user_sentence=sentence,
                )

            if has_aller and has_infinitive:
                return GrammarEvaluationResult(
                    is_correct=True,
                    target_pattern_matched=True,
                    score=95,
                    status="correct",
                    corrected_sentence=sentence,
                    positive_feedback=(
                        "Xuất sắc! Bạn đã áp dụng chính xác thì tương lai gần (futur proche): aller (hiện tại) + động từ nguyên mẫu."
                        if is_vi
                        else "Excellent ! Vous avez bien utilisé le futur proche (aller + infinitif)."
                    ),
                    suggested_alternatives=[
                        sentence.rstrip(".") + " bientôt.",
                        sentence.rstrip(".") + " avec plaisir.",
                    ],
                    diff_tokens=compute_sentence_diff(sentence, sentence),
                    rule_id=request.target_rule_id,
                    rule_name=request.target_rule_name,
                    user_sentence=sentence,
                )
            elif has_aller and not has_infinitive:
                corrected = f"{sentence.rstrip('.')} faire mes courses."
                return GrammarEvaluationResult(
                    is_correct=False,
                    target_pattern_matched=False,
                    score=50,
                    status="incorrect",
                    corrected_sentence=corrected,
                    error_explanation=(
                        "Câu của bạn có 'aller' nhưng chưa có động từ nguyên mẫu theo sau. Cấu trúc thì tương lai gần: aller + infinitif (ví dụ: Je vais visiter, Je vais partir)."
                        if is_vi
                        else "Le futur proche nécessite le verbe 'aller' suivi d'un infinitif."
                    ),
                    suggested_alternatives=["Je vais partir bientôt.", "Nous allons voyager."],
                    diff_tokens=compute_sentence_diff(sentence, corrected),
                    rule_id=request.target_rule_id,
                    rule_name=request.target_rule_name,
                    user_sentence=sentence,
                )
            else:
                corrected = "Je vais " + sentence.lower()
                return GrammarEvaluationResult(
                    is_correct=False,
                    target_pattern_matched=False,
                    score=30,
                    status="incorrect",
                    corrected_sentence=corrected,
                    error_explanation=(
                        "Câu chưa sử dụng dạng chia của động từ 'aller' ở hiện tại (vais, vas, va, allons, allez, vont)."
                        if is_vi
                        else "La phrase ne contient pas de forme conjuguée du verbe 'aller'."
                    ),
                    suggested_alternatives=["Je vais lire ce livre.", "Il va voyager à Paris."],
                    diff_tokens=compute_sentence_diff(sentence, corrected),
                    rule_id=request.target_rule_id,
                    rule_name=request.target_rule_name,
                    user_sentence=sentence,
                )

        # 2. Passé composé (avoir/être + participe passé)
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
                    corrected_sentence=sentence,
                    positive_feedback=(
                        "Rất tốt! Cấu trúc quá khứ (passé composé) với trợ từ và phân từ quá khứ được phối hợp chuẩn xác."
                        if is_vi
                        else "Très bien ! La structure du passé composé est bien respectée."
                    ),
                    suggested_alternatives=[sentence.rstrip(".") + " hier."],
                    diff_tokens=compute_sentence_diff(sentence, sentence),
                    rule_id=request.target_rule_id,
                    rule_name=request.target_rule_name,
                    user_sentence=sentence,
                )
            corrected = "J'ai terminé mon travail."
            return GrammarEvaluationResult(
                is_correct=False,
                target_pattern_matched=False,
                score=45,
                status="incorrect",
                corrected_sentence=corrected,
                error_explanation=(
                    "Thì passé composé yêu cầu một trợ từ (avoir hoặc être) ở thì hiện tại đi kèm phân từ quá khứ (participe passé)."
                    if is_vi
                    else "Le passé composé requiert un auxiliaire (avoir ou être) suivi du participe passé."
                ),
                suggested_alternatives=["J'ai vu ce film.", "Elle est allée au marché."],
                diff_tokens=compute_sentence_diff(sentence, corrected),
                rule_id=request.target_rule_id,
                rule_name=request.target_rule_name,
                user_sentence=sentence,
            )

        # 3. Négation (ne ... pas/jamais/rien/plus)
        if "negation" in rule_id:
            has_ne = bool(re.search(r"\b(ne|n')\b", lower))
            has_neg_word = bool(re.search(r"\b(pas|jamais|rien|plus|aucun|personne)\b", lower))

            if has_ne and has_neg_word:
                return GrammarEvaluationResult(
                    is_correct=True,
                    target_pattern_matched=True,
                    score=96,
                    status="correct",
                    corrected_sentence=sentence,
                    positive_feedback=(
                        "Chuẩn xác! Cặp từ phủ định bao quanh động từ đúng vị trí chuẩn tiếng Pháp."
                        if is_vi
                        else "Bravo ! La structure négative encadre parfaitement le verbe."
                    ),
                    suggested_alternatives=[sentence],
                    diff_tokens=compute_sentence_diff(sentence, sentence),
                    rule_id=request.target_rule_id,
                    rule_name=request.target_rule_name,
                    user_sentence=sentence,
                )
            corrected = "Je ne sais pas."
            return GrammarEvaluationResult(
                is_correct=False,
                target_pattern_matched=False,
                score=40,
                status="incorrect",
                corrected_sentence=corrected,
                error_explanation=(
                    "Trong tiếng Pháp chuẩn, cấu trúc phủ định cần có 'ne' (hoặc 'n\'') đứng trước động từ và từ phủ định ('pas', 'jamais', 'rien'...) đứng sau."
                    if is_vi
                    else "En français standard, la négation encadre le verbe avec 'ne' et un mot négatif."
                ),
                suggested_alternatives=["Je ne mange pas de viande.", "Il ne vient jamais."],
                diff_tokens=compute_sentence_diff(sentence, corrected),
                rule_id=request.target_rule_id,
                rule_name=request.target_rule_name,
                user_sentence=sentence,
            )

        # 4. Default fallback for other grammar rules
        words = lower.split()
        if len(words) >= 3:
            return GrammarEvaluationResult(
                is_correct=True,
                target_pattern_matched=True,
                score=85,
                status="correct",
                corrected_sentence=sentence,
                positive_feedback="Câu được diễn đạt mạch lạc và tự nhiên.",
                suggested_alternatives=[sentence],
                diff_tokens=compute_sentence_diff(sentence, sentence),
                rule_id=request.target_rule_id,
                rule_name=request.target_rule_name,
                user_sentence=sentence,
            )
        return GrammarEvaluationResult(
            is_correct=False,
            target_pattern_matched=False,
            score=40,
            status="incorrect",
            corrected_sentence="Veuillez écrire une phrase complète.",
            error_explanation="Câu quá ngắn hoặc chưa hoàn chỉnh để đánh giá ngữ pháp.",
            suggested_alternatives=["Je vais étudier le français ce soir."],
            diff_tokens=compute_sentence_diff(sentence, "Veuillez écrire une phrase complète."),
            rule_id=request.target_rule_id,
            rule_name=request.target_rule_name,
            user_sentence=sentence,
        )

    async def explain_grammar_point(self, request: GrammarExplanationRequest) -> GrammarExplanationResult:
        rule_id = request.rule_id.lower()

        if "futur_proche" in rule_id or "aller" in rule_id:
            return GrammarExplanationResult(
                rule_id=request.rule_id,
                rule_name="Futur proche (aller + infinitif)",
                summary="Thì tương lai gần diễn tả một hành động sắp xảy ra ngay tức thì hoặc một dự định chắc chắn.",
                formula="Sujet + aller (au présent) + Verbe à l'infinitif",
                key_rules=[
                    "Chỉ chia động từ 'aller' ở thì hiện tại (vais, vas, va, allons, allez, vont).",
                    "Động từ hành động theo sau luôn giữ ở dạng nguyên mẫu (infinitif).",
                    "Ở dạng phủ định, 'ne... pas' chỉ kẹp quanh động từ aller : 'Je ne vais pas partir'.",
                    "Đại từ tân ngữ đứng giữa 'aller' và động từ nguyên mẫu: 'Je vais le faire'.",
                ],
                common_mistakes=[
                    "Quên chia aller: *'Je aller manger' -> 'Je vais manger'",
                    "Chia cả hai động từ: *'Je vais mange' -> 'Je vais manger'",
                ],
                conjugation_or_forms={
                    "je": "vais + infinitif",
                    "tu": "vas + infinitif",
                    "il / elle / on": "va + infinitif",
                    "nous": "allons + infinitif",
                    "vous": "allez + infinitif",
                    "ils / elles": "vont + infinitif",
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
                summary="Thì quá khứ diễn tả hành động đã hoàn thành trọn vẹn tại một thời điểm xác định trong quá khứ.",
                formula="Sujet + auxiliaire (avoir hoặc être) + participe passé",
                key_rules=[
                    "Đa số động từ chia với trợ từ 'avoir'.",
                    "Động từ chỉ sự chuyển động (DR & MRS VANDERTRAMP) và động từ phản thân chia với 'être'.",
                    "Với 'être', phân từ quá khứ phải hòa hợp giống và số với chủ ngữ.",
                ],
                common_mistakes=[
                    "Dùng sai trợ từ: *'J'ai allé' -> 'Je suis allé(e)'",
                    "Quên hợp giống số với être: *'Elles sont parti' -> 'Elles sont parties'",
                ],
                conjugation_or_forms={
                    "avoir": "ai, as, a, avons, avez, ont",
                    "être": "suis, es, est, sommes, êtes, sont",
                },
                examples=[
                    "J'ai fini mon livre hier.",
                    "Elle est partie tôt ce matin.",
                    "Nous avons mangé ensemble.",
                ],
            )

        return GrammarExplanationResult(
            rule_id=request.rule_id,
            rule_name=request.rule_name,
            summary=f"Quy tắc ngữ pháp cho {request.rule_name}.",
            formula="Cấu trúc ngữ pháp tương ứng",
            key_rules=["Tuân thủ quy tắc kết hợp từ và chia động từ."],
            common_mistakes=["Lưu ý các trường hợp ngoại lệ."],
            conjugation_or_forms={},
            examples=[f"Exemple d'utilisation de {request.rule_name}."],
        )
