"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

const missionTabs = [
  {
    id: "doctor",
    label: "Highly Qualified Doctor",
    icon: "/icons/storefront/mission/tab-doctor.svg",
    title: "Highly Qualified Doctor",
    image: "/images/storefront/mission/qualified-doctor.png",
    imageAlt: "Highly qualified doctor with a medical team",
    imagePosition: "center",
    description: [
      "We pride itself on providing highly qualified and experienced medical professionals. Our staffing solutions are catered to your specific needs and staff complement.",
      "Our services do not only include medical treatment and evacuation, but also clinic management, stock control, pharmaceutical management, auditing,",
    ],
    checklist: [
      { label: "We accept many insurance plans and offer discounts" },
      { label: "Friendly team you can call friends" },
      { label: "We use energy saving and waste reducing methods" },
      { label: "They’re experts on the heart and blood vessels" },
    ],
  },
  {
    id: "equipment",
    label: "Modern Equipment",
    icon: "/icons/storefront/mission/tab-equipment.svg",
    title: "State of the Art Medical Equipment for Precision Care",
    image: "/images/storefront/mission/modern-equipment.png",
    imageAlt: "Patient receiving care with modern medical imaging equipment",
    imagePosition: "center",
    description: [
      "Our facility is equipped with the latest in advanced medical technology, ensuring accurate diagnostics, efficient treatments, and enhanced patient safety. From cutting edge imaging systems to minimally invasive surgical tools, every piece of equipment is chosen to support high quality care and better outcomes.",
      "We invest in innovation so you receive the most reliable, up to date healthcare available today.",
    ],
    checklist: [
      { label: "MRI Scanner (Magnetic Resonance Imaging)" },
      { label: "CT Scanner (Computed Tomography)" },
      { label: "Laparoscopic Surgical Equipment" },
    ],
  },
  {
    id: "prices",
    label: "Transparent Prices",
    icon: "/icons/storefront/mission/tab-prices.svg",
    title: "Transparent Prices, Honest Care",
    image: "/images/storefront/mission/transparent-prices.png",
    imageAlt: "Medical professional performing a procedure",
    imagePosition: "right",
    description: [
      "We believe quality healthcare should come with clarity and confidence. That’s why we offer transparent pricing no hidden fees, no surprises. From consultations to procedures, our patients are fully informed about costs upfront, empowering them to make the best decisions for their health and budget.",
    ],
    checklist: [
      { label: "Upfront Cost Estimates", description: "Receive clear quotes before any procedure or service is performed." },
      { label: "Flexible Payment Options", description: "Multiple payment plans to suit your budget and financial needs." },
      { label: "Breakdown of Services", description: "Detailed billing that explains exactly what you're paying for." },
    ],
  },
  {
    id: "pain-free",
    label: "Pain-Free Treatment",
    icon: "/icons/storefront/mission/tab-pain-free.svg",
    title: "Pain-Free Treatment for Your Comfort and Peace of Mind",
    image: "/images/storefront/mission/pain-free-treatment.png",
    imageAlt: "Healthcare professional reassuring a patient during treatment",
    imagePosition: "center",
    description: ["We’re committed to making every visit as comfortable as possible. Our pain-free approach includes:"],
    checklist: [
      { label: "Advanced Anesthesia Options", description: "Local, topical, and sedation techniques tailored to your needs." },
      { label: "Minimally Invasive Procedures", description: "Reduced discomfort and faster recovery using the latest technology." },
      { label: "Laser Assisted Treatments", description: "Precise, gentle care with less pain and quicker healing." },
      { label: "Comfort Focused Environments", description: "Relaxing spaces designed to reduce stress and promote ease." },
    ],
  },
] as const;

export default function StorefrontMissionTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(index: number) {
    setActiveTab(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % missionTabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + missionTabs.length) % missionTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = missionTabs.length - 1;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      selectTab(nextIndex);
    }
  }

  const activeTabId = missionTabs[activeTab].id;
  const activeMission = missionTabs[activeTab];
  const hasChecklistDescriptions = activeMission.checklist.some((item) => "description" in item);

  return (
    <div className="storefront-mission__card">
      <div className="storefront-mission__tabs" role="tablist" aria-label="Our mission highlights">
        {missionTabs.map((tab, index) => {
          const isActive = index === activeTab;

          return (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`mission-tab-${tab.id}`}
              className="storefront-mission__tab"
              type="button"
              role="tab"
              aria-controls="mission-panel"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span
                className="storefront-mission__tab-icon"
                style={{ "--mission-tab-icon": `url(${tab.icon})` } as CSSProperties}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        id="mission-panel"
        className="storefront-mission__panel"
        role="tabpanel"
        aria-labelledby={`mission-tab-${activeTabId}`}
        tabIndex={0}
      >
        <div className="storefront-mission__panel-image">
          <Image
            src={activeMission.image}
            alt={activeMission.imageAlt}
            width={996}
            height={664}
            unoptimized
            sizes="(min-width: 1200px) 570px, (min-width: 768px) 70vw, calc(100vw - 80px)"
            style={{ objectPosition: activeMission.imagePosition }}
          />
        </div>

        <div className="storefront-mission__panel-copy">
          <h3 className="storefront-heading storefront-heading-4">{activeMission.title}</h3>
          <div className="storefront-mission__panel-description storefront-body">
            {activeMission.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>

          <ul className={`storefront-mission__checklist${hasChecklistDescriptions ? " storefront-mission__checklist--detailed" : ""}`}>
            {activeMission.checklist.map((item) => (
              <li key={item.label}>
                <Image src="/icons/storefront/mission/check.svg" alt="" width={17} height={17} aria-hidden="true" />
                <div className="storefront-mission__checklist-copy">
                  <span>{item.label}</span>
                  {"description" in item ? <p>{item.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
