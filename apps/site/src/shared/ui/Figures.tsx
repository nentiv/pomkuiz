import { assetUrl } from "../data/quiz-api.ts";
import { MESSAGES } from "../i18n/messages-fr.ts";
import "./figures.css";

function Figures({ quizId, images, label }: { quizId: string; images?: readonly string[]; label: string }) {
  if (!images || images.length === 0) return null;
  return (
    <div class="figures">
      {images.map((image, index) => (
        <figure key={image} class="figure">
          <img
            src={assetUrl(quizId, image)}
            alt={`${MESSAGES.session.figure(index + 1)} – ${label}`}
            loading="lazy"
            decoding="async"
          />
        </figure>
      ))}
    </div>
  );
}

export { Figures };
