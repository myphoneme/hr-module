import { Font } from '@react-pdf/renderer';
import { LongFormTemplate } from './LongFormTemplate';
import { InternshipTemplate } from './InternshipTemplate';
import { ContractExtensionTemplate } from './ContractExtensionTemplate';

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helvetica/v15/0QtuG-dEaLdG2a3uYg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/helvetica/v15/0QtuG-dEaLdG2a3uYg.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/helvetica-bold/v15/0QtuG-dEaLdG2a3uYg.ttf', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/helvetica-bold/v15/0QtuG-dEaLdG2a3uYg.ttf', fontWeight: 'bold' },
  ],
});

interface OfferLetterPDFProps {
  letterContent: any;
}

export function OfferLetterPDF({ letterContent }: OfferLetterPDFProps) {
  const templateType = letterContent.templateType;

  // Use detailed multi-page OFFER CUM APPOINTMENT LETTER format
  // Only use different templates for internship and extension
  switch (templateType) {
    case 'internship':
      return <InternshipTemplate letterContent={letterContent} />;
    case 'extension':
      return <ContractExtensionTemplate letterContent={letterContent} />;
    default:
      // Use detailed multi-page offer letter template (6-8 pages)
      return <LongFormTemplate letterContent={letterContent} />;
  }
}
