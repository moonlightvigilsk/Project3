import re
from typing import Dict, Any, List
from app.services.llm.base import LLMClient
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
    LLMStructuredEvaluation,
    PracticeErrorDetail,
    RuleCheckResult,
)
from app.services.spacy_engine.diff import compute_sentence_diff


class MockLLMProvider(LLMClient):
    """Deterministic offline mock client with Vietnamese pedagogical explanations."""

    @property
    def provider_name(self) -> str:
        return "mock"

    async def health_check(self) -> bool:
        return True

    async def evaluate_practice_submission(
        self,
        user_sentence: str,
        target_rule_id: str,
        target_rule_name: str,
        rule_check: RuleCheckResult,
    ) -> LLMStructuredEvaluation:
        sentence = user_sentence.strip()
        lower = sentence.lower()
        errors: List[PracticeErrorDetail] = []
        is_correct = True
        uses_construct = rule_check.pattern_matched
        corrected_sentence = sentence
        comment = "Câu sử dụng đúng cấu trúc ngữ pháp tiếng Pháp."

        # Case 1: Auxiliary subject agreement failed
        if not rule_check.auxiliary_correct and rule_check.auxiliary_token:
            is_correct = False
            uses_construct = False
            expected_aux = "vais"
            if rule_check.subject_token in ("tu", "toi"): expected_aux = "vas"
            elif rule_check.subject_token in ("il", "elle", "on"): expected_aux = "va"
            elif rule_check.subject_token in ("nous",): expected_aux = "allons"
            elif rule_check.subject_token in ("vous",): expected_aux = "allez"
            elif rule_check.subject_token in ("ils", "elles"): expected_aux = "vont"

            errors.append(
                PracticeErrorDetail(
                    span=rule_check.auxiliary_token,
                    type="conjugation",
                    explanation_vi=f"Động từ 'aller' chia sai với chủ ngữ '{rule_check.subject_token or 'đã cho'}'. Dạng đúng là '{expected_aux}'.",
                    suggestion=expected_aux,
                )
            )
            corrected_sentence = re.sub(
                rf"\b{re.escape(rule_check.auxiliary_token)}\b",
                expected_aux,
                sentence,
                flags=re.IGNORECASE,
            )
            comment = f"Cần hòa hợp động từ 'aller' với chủ ngữ ({rule_check.subject_token or ''} -> {expected_aux})."

        # Case 2: Main verb not in infinitive
        elif not rule_check.main_verb_infinitive and rule_check.auxiliary_token:
            is_correct = False
            # Check double conjugation like 'vais mange' -> 'vais manger'
            double_conj = re.search(rf"\b({rule_check.auxiliary_token})\s+(\w+)\b", lower)
            if double_conj:
                v2 = double_conj.group(2)
                # Suggest infinitive
                inf_v = v2 + "r" if v2.endswith("e") else v2
                errors.append(
                    PracticeErrorDetail(
                        span=v2,
                        type="infinitive",
                        explanation_vi=f"Sau 'aller' ở thì hiện tại, động từ chính phải ở dạng nguyên mẫu (infinitif), không được chia.",
                        suggestion=inf_v,
                    )
                )
                corrected_sentence = re.sub(rf"\b{re.escape(v2)}\b", inf_v, sentence)
                comment = "Động từ theo sau 'aller' phải ở dạng nguyên mẫu."
            else:
                comment = "Thiếu động từ nguyên mẫu theo sau 'aller'."

        # Case 3: Missing construct altogether (e.g. 'Je vais a Hanoi')
        elif not rule_check.pattern_matched:
            is_correct = False
            uses_construct = False
            comment = "Câu chưa sử dụng cấu trúc tương lai gần (aller + infinitif)."
            corrected_sentence = f"{sentence.rstrip('.')} faire un voyage."
            errors.append(
                PracticeErrorDetail(
                    span=sentence,
                    type="missing_construct",
                    explanation_vi="Cấu trúc 'aller + infinitif' yêu cầu một động từ nguyên mẫu hành động theo sau trợ từ 'aller'.",
                    suggestion=corrected_sentence,
                )
            )

        else:
            # Fully correct
            is_correct = True
            uses_construct = True
            comment = "Xuất sắc! Bạn đã áp dụng chính xác cấu trúc ngữ pháp đích."

        return LLMStructuredEvaluation(
            is_correct=is_correct,
            uses_target_construct=uses_construct,
            errors=errors,
            corrected_sentence=corrected_sentence,
            short_comment=comment,
        )

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
                        sentence.rstrip(".") + " với niềm vui.",
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
                    positive_feedback="Rất tốt! Cấu trúc quá khứ (passé composé) với trợ từ và phân từ quá khứ được phối hợp chuẩn xác.",
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
                error_explanation="Thì passé composé yêu cầu một trợ từ (avoir hoặc être) ở thì hiện tại đi kèm phân từ quá khứ (participe passé).",
                suggested_alternatives=["J'ai vu ce film.", "Elle est allée au marché."],
                diff_tokens=compute_sentence_diff(sentence, corrected),
                rule_id=request.target_rule_id,
                rule_name=request.target_rule_name,
                user_sentence=sentence,
            )

        # 3. Négation
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
                    positive_feedback="Chuẩn xác! Cặp từ phủ định bao quanh động từ đúng vị trí chuẩn tiếng Pháp.",
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
                error_explanation="Trong tiếng Pháp chuẩn, cấu trúc phủ định cần có 'ne' (hoặc 'n\'') đứng trước động từ và từ phủ định ('pas', 'jamais', 'rien'...) đứng sau.",
                suggested_alternatives=["Je ne mange pas de viande.", "Il ne vient jamais."],
                diff_tokens=compute_sentence_diff(sentence, corrected),
                rule_id=request.target_rule_id,
                rule_name=request.target_rule_name,
                user_sentence=sentence,
            )

        # Default fallback
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
