"use client";

import Image from "next/image";
import {
  type Dispatch,
  type SetStateAction,
  useId,
  useState,
} from "react";

type FaqItem = {
  answer?: string;
  id: string;
  question: string;
};

const faqItems: readonly FaqItem[] = [
  {
    id: "services",
    question: "What services does BigMedix Clinic offer?",
    answer:
      "At BigMedix Clinic, we provide a full range of dental services, including preventive care, restorative dentistry, cosmetic treatments, orthodontics, emergency care, and specialized procedures like root canals.",
  },
  {
    id: "cosmetic",
    question: "Are your cosmetic treatments natural looking?",
    answer:
      "Yes, our cosmetic treatments are designed to enhance your natural smile. We use high-quality materials and advanced techniques to ensure that the results look natural and blend seamlessly with your existing teeth.",
  },
  {
    id: "visit-frequency",
    question: "How often should I visit the dentist?",
    answer:
      "We recommend visiting the dentist at least twice a year for routine checkups and cleanings.",
  },
  {
    id: "dental-emergency-primary",
    question: "What should I do in a dental emergency?",
    answer:
      "If you experience a dental emergency, please call our office immediately. We will do our best to accommodate you on the same day.",
  },
  {
    id: "orthodontic",
    question: "How do I know if I need orthodontic treatment?",
    answer:
      "Our orthodontic specialists will evaluate your teeth and jaw alignment to determine if orthodontic treatment is necessary.",
  },
  {
    id: "product-quality",
    question: "How do you guarantee the product quality?",
    answer:
      "We source our products from trusted manufacturers and maintain strict quality control measures to ensure the highest standards.",
  },
  {
    id: "customer-geography",
    question: "What is your customer geography?",
    answer:
      "We serve customers across the United States, with locations in major metropolitan areas.",
  },
  {
    id: "dental-emergency-secondary",
    question: "What should I do in a dental emergency?",
    answer:
      "If you experience a dental emergency, please call our office immediately. We will do our best to accommodate you on the same day.",
  },
  {
    id: "industries",
    question: "What are the main industries we serve?",
    answer:
      "We serve a wide range of industries, including healthcare, education, technology, and more.",
  },
  {
    id: "selection",
    question: "How is the selection process organized?",
    answer:
      "Our selection process is organized to ensure that we choose the best candidates for our team, based on their skills, experience, and alignment with our values.",
  },
] as const;

function FaqColumn({
  idPrefix,
  items,
  offset,
  openIndex,
  setOpenIndex,
}: {
  idPrefix: string;
  items: readonly FaqItem[];
  offset: number;
  openIndex: number | null;
  setOpenIndex: Dispatch<SetStateAction<number | null>>;
}) {
  return (
    <div className="storefront-faqs__column">
      {items.map((item, localIndex) => {
        const index = offset + localIndex;
        const isOpen = openIndex === index;
        const questionId = `${idPrefix}-question-${item.id}`;
        const answerId = `${idPrefix}-answer-${item.id}`;

        return (
          <article
            className={[
              "storefront-faqs__item",
              isOpen ? "storefront-faqs__item--open" : "",
              item.answer ? "storefront-faqs__item--has-answer" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={item.id}
          >
            <h3>
              <button
                aria-controls={answerId}
                aria-expanded={isOpen}
                className="storefront-faqs__trigger"
                id={questionId}
                onClick={() =>
                  setOpenIndex((current) =>
                    current === index ? null : index,
                  )
                }
                type="button"
              >
                <span>{item.question}</span>
                <Image
                  alt=""
                  aria-hidden="true"
                  className="storefront-faqs__chevron"
                  height={24}
                  src={
                    isOpen
                      ? "/icons/storefront/faqs/chevron-open.svg"
                      : "/icons/storefront/faqs/chevron-closed.svg"
                  }
                  width={24}
                />
              </button>
            </h3>
            <div
              aria-hidden={!isOpen}
              aria-labelledby={questionId}
              className={[
                "storefront-faqs__answer",
                isOpen ? "storefront-faqs__answer--open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              id={answerId}
              role="region"
            >
              <div className="storefront-faqs__answer-inner">
                {item.answer ? <p>{item.answer}</p> : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function StorefrontFaqs() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const idPrefix = useId();

  return (
    <section
      aria-labelledby="storefront-faqs-title"
      className="storefront-faqs"
    >
      <div className="storefront-faqs__container">
        <header className="storefront-faqs__header">
          <div className="storefront-faqs__heading">
            <div className="storefront-faqs__eyebrow">
              <Image
                alt=""
                aria-hidden="true"
                height={20}
                src="/icons/storefront/faqs/eyebrow.svg"
                width={20}
              />
              <span>Have a question</span>
            </div>
            <h2
              className="storefront-heading storefront-heading-2 storefront-faqs__title"
              id="storefront-faqs-title"
            >
              Speak with one of our health tech experts
            </h2>
          </div>
          <p className="storefront-faqs__description storefront-body">
            Whether you&apos;re visiting for a routine check-up or a more
            advanced procedure, we ensure your oral health is in the best hands,
            helping you achieve a confident.
          </p>
        </header>

        <div className="storefront-faqs__grid">
          <FaqColumn
            idPrefix={idPrefix}
            items={faqItems.slice(0, 5)}
            offset={0}
            openIndex={openIndex}
            setOpenIndex={setOpenIndex}
          />
          <FaqColumn
            idPrefix={idPrefix}
            items={faqItems.slice(5)}
            offset={5}
            openIndex={openIndex}
            setOpenIndex={setOpenIndex}
          />
        </div>
      </div>
    </section>
  );
}
