from .base import BasePromptBuilder


class ImagePromptBuilder(BasePromptBuilder):
    """
    Composes a direct, cohesive visual prompt combining the user's request with saved Brand Identity.
    """

    def build(  # type: ignore[override]
        self,
        user_prompt: str,
        brand_identity: dict | None = None,
        platform: str | None = None,
        aspect_ratio: str | None = None,
        has_logo_reference: bool = False,
        reference_count: int = 0,
    ) -> str:
        brand = brand_identity or {}
        sections = [user_prompt.strip()]

        brand_details = []
        if brand.get("brand_description"):
            brand_details.append(f"Brand context: {brand['brand_description'].strip()}")
        if brand.get("target_audience"):
            brand_details.append(f"Target audience: {brand['target_audience'].strip()}")
        if brand.get("tone"):
            brand_details.append(f"Brand tone and mood: {brand['tone'].strip()}")
        if brand.get("visual_style"):
            brand_details.append(f"Visual style: {brand['visual_style'].strip()}")

        colors = brand.get("brand_colors") or []
        if isinstance(colors, str):
            colors = [c.strip() for c in colors.split(",") if c.strip()]
        if colors:
            brand_details.append(f"Brand color palette: {', '.join(str(c) for c in colors)}")

        if brand.get("guidelines"):
            brand_details.append(f"Brand guidelines: {brand['guidelines'].strip()}")

        if brand_details:
            sections.append("Brand identity guidance:\n- " + "\n- ".join(brand_details))

        if has_logo_reference:
            sections.append(
                "Incorporate the provided brand logo cleanly and naturally into the composition while maintaining high legibility and brand consistency."
            )
        if reference_count > 0:
            sections.append(
                "Maintain visual continuity, lighting, materials, and aesthetic coherence with the provided brand reference image(s)."
            )

        framing = []
        if platform and platform != "Multi-Platform":
            framing.append(f"optimized for {platform}")
        if aspect_ratio:
            framing.append(f"composed for {aspect_ratio} framing")
        if framing:
            sections.append(f"Composition: {', '.join(framing)}.")

        return "\n\n".join(part for part in sections if part).strip()
