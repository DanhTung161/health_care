import Image from "next/image";

function TextRunGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="storefront-text-run__group" aria-hidden={hidden || undefined}>
      <span>Precision services</span>
      <Image
        className="storefront-text-run__heart"
        src="/icons/storefront/text-run/heart.svg"
        alt=""
        width={90}
        height={90}
        aria-hidden="true"
      />
      <span>expert results</span>
    </div>
  );
}

export default function StorefrontTextRun() {
  return (
    <section className="storefront-text-run" aria-label="Precision services, expert results">
      <div className="storefront-text-run__viewport">
        <div className="storefront-text-run__track">
          <TextRunGroup />
          <TextRunGroup hidden />
        </div>
      </div>
    </section>
  );
}