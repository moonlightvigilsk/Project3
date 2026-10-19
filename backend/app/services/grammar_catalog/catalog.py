from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class GrammarRuleMetadata(BaseModel):
    """Metadata representing a curated French grammar concept."""

    id: str
    name: str
    category: str
    level: str  # A1, A2, B1, B2
    formula: str
    description: str
    key_points: List[str]
    conjugation_table: Dict[str, Any] = Field(default_factory=dict)
    examples: List[str]
    keywords: List[str] = Field(default_factory=list)


FRENCH_GRAMMAR_CATALOG: Dict[str, GrammarRuleMetadata] = {
    "futur_proche": GrammarRuleMetadata(
        id="futur_proche",
        name="Futur proche (aller + infinitif)",
        category="Temps du verbe",
        level="A1-A2",
        formula="Sujet + aller (présent) + verbe à l'infinitif",
        description="Exprime une action imminente ou une intention déjà arrêtée dans un avenir proche.",
        key_points=[
            "Seul l'auxiliaire 'aller' se conjugue au présent de l'indicatif.",
            "Le verbe d'action reste toujours à l'infinitif.",
            "À la forme négative, 'ne... pas' entoure le verbe aller : 'Je ne vais pas partir'.",
            "Les pronoms compléments se placent entre 'aller' et l'infinitif : 'Je vais le faire'.",
        ],
        conjugation_table={
            "je": "vais + infinitif",
            "tu": "vas + infinitif",
            "il / elle / on": "va + infinitif",
            "nous": "allons + infinitif",
            "vous": "allez + infinitif",
            "ils / elles": "vont + infinitif",
        },
        examples=[
            "Je vais visiter mon ami ce week-end.",
            "Nous allons partir en voyage la semaine prochaine.",
            "Elle va commencer un nouveau roman.",
            "Qu'est-ce que vous allez faire ce soir ?",
        ],
        keywords=["aller", "infinitif", "futur", "proche", "demain", "bientôt"],
    ),
    "passe_compose": GrammarRuleMetadata(
        id="passe_compose",
        name="Passé composé (avoir/être + participe passé)",
        category="Temps du verbe",
        level="A2",
        formula="Sujet + auxiliaire (avoir / être au présent) + participe passé",
        description="Exprime une action passée, achevée et ponctuelle dans le temps.",
        key_points=[
            "La plupart des verbes utilisent l'auxiliaire 'avoir'.",
            "Les verbes de déplacement/état (DR MRS VANDERTRAMP) et tous les verbes pronominaux se conjuguent avec 'être'.",
            "Avec 'être', le participe passé s'accorde en genre (-e) et en nombre (-s) avec le sujet.",
            "Avec 'avoir', l'accord ne se fait qu'avec le COD s'il est placé avant le verbe.",
        ],
        conjugation_table={
            "avoir": "ai, as, a, avons, avez, ont",
            "être": "suis, es, est, sommes, êtes, sont",
            "terminaisons_participe": {
                "verbes en -er": "-é (parlé, chanté)",
                "verbes en -ir": "-i (fini, choisi)",
                "verbes en -re/irréguliers": "-u, -is, -it (vu, pris, fait, dit)",
            },
        },
        examples=[
            "J'ai terminé la lecture de ce livre hier soir.",
            "Elle est allée à la bibliothèque ce matin.",
            "Nous avons beaucoup apprécié cette histoire.",
            "Ils sont partis avant le coucher du soleil.",
        ],
        keywords=["passé", "composé", "avoir", "être", "participe", "hier"],
    ),
    "imparfait": GrammarRuleMetadata(
        id="imparfait",
        name="Imparfait de l'indicatif",
        category="Temps du verbe",
        level="A2-B1",
        formula="Radical de 'nous' au présent + (-ais, -ais, -ait, -ions, -iez, -aient)",
        description="Exprime une habitude passée, une description, un décor ou une action en cours d'accomplissement.",
        key_points=[
            "Prendre le radical de la première personne du pluriel (nous) au présent de l'indicatif.",
            "Les terminaisons sont identiques pour tous les verbes : -ais, -ais, -ait, -ions, -iez, -aient.",
            "Seule exception pour le radical : le verbe être (ét-).",
        ],
        conjugation_table={
            "je": "-ais",
            "tu": "-ais",
            "il / elle / on": "-ait",
            "nous": "-ions",
            "vous": "-iez",
            "ils / elles": "-aient",
        },
        examples=[
            "Quand j'étais petit, je lisais chaque soir avant de m'endormir.",
            "Le vent soufflait doucement à travers les arbres.",
            "Nous habitions dans une vieille maison près de la mer.",
        ],
        keywords=["imparfait", "description", "habitude", "passé", "autrefois"],
    ),
    "negation": GrammarRuleMetadata(
        id="negation",
        name="Négation (ne ... pas / jamais / rien / plus)",
        category="Structure de la phrase",
        level="A1-A2",
        formula="ne (ou n') + verbe conjugué + pas / jamais / rien / plus / aucun",
        description="Encadre le verbe pour exprimer la négation totale, l'absence ou la fréquence nulle.",
        key_points=[
            "'ne' devient 'n\'' devant une voyelle ou un 'h' muet.",
            "Aux temps composés, 'ne' et le mot négatif encadrent l'auxiliaire : 'Je n'ai pas compris'.",
            "Devant un infinitif, les deux éléments restent groupés : 'Il m'a demandé de ne pas fumer'.",
        ],
        conjugation_table={
            "pas": "négation neutre",
            "jamais": "négation de fréquence (opposé de toujours/souvent)",
            "rien": "négation d'objet (opposé de quelque chose/tout)",
            "plus": "cessation d'état (opposé de encore)",
        },
        examples=[
            "Je ne comprends pas cette règle compliquée.",
            "Il n'a jamais voyagé hors de son pays.",
            "Elle ne dit rien pendant la réunion.",
            "Nous ne voulons plus attendre.",
        ],
        keywords=["ne", "pas", "jamais", "rien", "plus", "négation"],
    ),
    "pronoms_cod_coi": GrammarRuleMetadata(
        id="pronoms_cod_coi",
        name="Pronoms compléments COD & COI",
        category="Pronoms",
        level="A2-B1",
        formula="Sujet + [me / te / se / nous / vous / le / la / les / lui / leur / y / en] + verbe",
        description="Remplacent un complément d'objet direct (COD) ou indirect (COI) et se placent avant le verbe conjugué.",
        key_points=[
            "COD (le, la, les) remplace un nom sans préposition : 'Je lis le livre' -> 'Je le lis'.",
            "COI (lui, leur) remplace un être animé précédé de 'à' : 'Je parle à Marie' -> 'Je lui parle'.",
            "En présence d'un verbe semi-auxiliaire + infinitif, le pronom se place devant l'infinitif : 'Je vais le voir'.",
        ],
        conjugation_table={
            "COD": "me, te, le, la, nous, vous, les",
            "COI": "me, te, lui, nous, vous, leur",
            "Adverbiaux": "y (lieu ou 'à + chose'), en ('de + chose' ou quantité)",
        },
        examples=[
            "Ce roman est fascinant, je le lis avec passion.",
            "Mon professeur est très patient, je lui pose souvent des questions.",
            "Tu as des pommes ? Oui, j'en ai trois.",
            "Tu vas à Paris ? Oui, j'y vais demain.",
        ],
        keywords=["pronom", "cod", "coi", "le", "la", "les", "lui", "leur", "y", "en"],
    ),
    "conditionnel_present": GrammarRuleMetadata(
        id="conditionnel_present",
        name="Conditionnel présent",
        category="Modes et temps",
        level="B1",
        formula="Radical du futur simple + terminaisons de l'imparfait (-ais, -ais, -ait, -ions, -iez, -aient)",
        description="Exprime la politesse, un souhait, un conseil, une information non confirmée ou une hypothèse.",
        key_points=[
            "Le radical est exactement celui du futur simple (ex: pour être -> ser-, avoir -> aur-, aller -> ir-).",
            "Les terminaisons sont celles de l'imparfait : -ais, -ais, -ait, -ions, -iez, -aient.",
            "S'utilise souvent avec 'si + imparfait' : 'Si j'avais le temps, je lirais davantage'.",
        ],
        conjugation_table={
            "aimer": "j'aimerais, tu aimerais, il aimerait, nous aimerions, vous aimeriez, ils aimeraient",
            "pouvoir": "je pourrais, tu pourrais, il pourrait, nous pourrions, vous pourriez, ils pourraient",
            "vouloir": "je voudrais, tu voudrais, il voudrait, nous voudrions, vous voudriez, ils voudraient",
        },
        examples=[
            "Je voudrais un verre d'eau, s'il vous plaît.",
            "Tu devrais lire ce chapitre avant le cours.",
            "S'il faisait beau, nous irions nous promener au parc.",
        ],
        keywords=["conditionnel", "souhait", "politesse", "voudrais", "pourrais"],
    ),
    "subjonctif_present": GrammarRuleMetadata(
        id="subjonctif_present",
        name="Subjonctif présent",
        category="Modes et temps",
        level="B1-B2",
        formula="que + sujet + radical (ils au présent) + (-e, -es, -e, -ions, -iez, -ent)",
        description="Exprime la subjectivité, la volonté, l'obligation, le doute ou le sentiment après des verbes ou conjonctions spécifiques.",
        key_points=[
            "Introduit presque toujours par la conjonction 'que' ou 'qu''.",
            "Radical basé sur la 3e personne du pluriel (ils) du présent de l'indicatif.",
            "Déclenché par des expressions d'obligation : 'Il faut que...', 'Il est nécessaire que...'.",
            "Déclenché par des conjonctions : 'bien que', 'pour que', 'avant que' (+ ne).",
        ],
        conjugation_table={
            "que je": "-e (que je parle, que je finisse)",
            "que tu": "-es (que tu parles, que tu finisses)",
            "qu'il / elle": "-e (qu'il parle, qu'il finisse)",
            "que nous": "-ions (que nous parlions, que nous finissions)",
            "que vous": "-iez (que vous parliez, que vous finissiez)",
            "qu'ils / elles": "-ent (qu'ils parlent, qu'ils finissent)",
        },
        examples=[
            "Il faut que tu fasses tes devoirs ce soir.",
            "Bien qu'il fasse froid, elle sort sans manteau.",
            "Je souhaite que vous réussissiez votre examen.",
        ],
        keywords=["subjonctif", "il faut que", "bien que", "souhait", "obligation"],
    ),
}


def get_rule_by_id(rule_id: str) -> Optional[GrammarRuleMetadata]:
    """Retrieve metadata for a rule ID."""
    return FRENCH_GRAMMAR_CATALOG.get(rule_id.lower().strip())


def list_all_rules() -> List[GrammarRuleMetadata]:
    """Return all catalogued French grammar rules."""
    return list(FRENCH_GRAMMAR_CATALOG.values())
