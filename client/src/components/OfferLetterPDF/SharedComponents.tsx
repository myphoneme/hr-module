import { Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { LOGO_BASE64 } from './logo';
import type { SalaryComponent, KRADetail } from '../../types';

// Letterhead data interface
export interface LetterheadData {
  header_image_base64?: string | null;
  footer_image_base64?: string | null;
  logo_image_base64?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_contact?: string | null;
  company_email?: string | null;
  company_website?: string | null;
  company_cin?: string | null;
  company_gstin?: string | null;
}

interface LetterHeaderProps {
  title?: string;
  date?: string;
  showTitle?: boolean;
  letterhead?: LetterheadData | null;
  hideDate?: boolean;
}

export function LetterHeader({ title, date, showTitle = false, hideDate = true }: LetterHeaderProps) {
  // Always use the Phoneme logo with black header line
  // Continuation pages - just show logo with header line
  if (!showTitle) {
    return (
      <View style={{ marginLeft: -72, marginRight: -72, marginTop: -50 }}>
        {/* Full width black header line */}
        <View style={{ height: 4, backgroundColor: '#000000', width: '100%' }} />
        {/* Logo below the line - positioned more to the left */}
        <View style={{ paddingLeft: 40, paddingRight: 72, marginTop: 15 }}>
          <Image src={LOGO_BASE64} style={styles.logo} />
        </View>
      </View>
    );
  }

  // First page - black line at top, logo below, then title
  // Date is shown separately in the reference number row for proper formatting
  return (
    <View style={{ marginLeft: -72, marginRight: -72, marginTop: -50 }}>
      {/* Full width black header line */}
      <View style={{ height: 4, backgroundColor: '#000000', width: '100%' }} />

      {/* Content area with margins restored */}
      <View style={{ paddingLeft: 72, paddingRight: 72, marginTop: 15 }}>
        {/* Logo - positioned more to the left */}
        <View style={{ marginLeft: -32 }}>
          <Image src={LOGO_BASE64} style={styles.logo} />
        </View>

        {/* Title centered */}
        {title && (
          <View style={{ alignItems: 'center', width: '100%', marginTop: 20, marginBottom: 15 }}>
            <Text style={styles.heading1}>{title}</Text>
          </View>
        )}

        {/* Date aligned right - only show if not hidden (default: hidden since shown in ref row) */}
        {date && !hideDate && (
          <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
            <Text style={styles.dateText}>{date}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

interface PageFooterProps {
  letterhead?: LetterheadData | null;
}

export function PageFooter({ letterhead: _letterhead }: PageFooterProps = {}) {
  // Use default company info - ignore letterhead to keep consistent branding
  const companyName = 'Phoneme Solutions Pvt Ltd.';
  const companyAddress = 'Advant Navis Business Park, B- 614 Sector 142, Noida - 201307';
  const companyCin = 'U74999DL2015PTC275921';
  const companyGstin = '07AAHCP9748G1ZX';
  const companyEmail = 'info@myphoneme.com';
  const companyWebsite = 'http://www.myphoneme.com';
  const regOffice = 'Reg.Off: 1/22, 2nd Floor, Asaf Ali Road, New Delhi-110017';

  return (
    <View style={styles.footer} fixed>
      {/* Footer line: 70% orange, 30% black */}
      <View style={{ flexDirection: 'row', width: '100%' }}>
        <View style={{ width: '70%', height: 3, backgroundColor: '#FF6B35' }} />
        <View style={{ width: '30%', height: 3, backgroundColor: '#000000' }} />
      </View>
      <View style={styles.footerContent}>
        <Text style={styles.footerText}>
          {companyName} {companyAddress} CIN: {companyCin} GST: {companyGstin}
        </Text>
        <Text style={styles.footerText}>
          {regOffice} {companyEmail} {companyWebsite}
        </Text>
      </View>
    </View>
  );
}

interface RecipientSectionProps {
  name: string;
  address: string;
  subject: string;
}

export function RecipientSection({ name, address, subject }: RecipientSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.recipientContainer}>
        <Text style={styles.textBold}>To,</Text>
        <Text style={styles.textBold}>{name},</Text>
        <Text style={styles.addressText}>{address}</Text>
      </View>
      <Text style={styles.subject}>Subject: {subject}</Text>
    </View>
  );
}

interface SignatureSectionProps {
  hrManagerName: string;
  hrManagerTitle: string;
  candidateName?: string;
  signatoryName?: string;
  signatoryPosition?: string;
  signatorySignature?: string;
  signatoryStamp?: string;
}

export function SignatureSection({
  hrManagerName,
  hrManagerTitle,
  candidateName,
  signatoryName,
  signatoryPosition,
  signatorySignature,
}: SignatureSectionProps) {
  const hasSignatory = signatoryName && signatoryPosition;
  const displayName = hasSignatory ? signatoryName : hrManagerName;
  const displayTitle = hasSignatory ? signatoryPosition : hrManagerTitle;

  // signatorySignature is now a base64 data URL from the server
  const hasSignatureImage = signatorySignature && signatorySignature.startsWith('data:');

  return (
    <View style={{ marginTop: 30 }}>
      {/* HR/Signatory signature */}
      <View>
        <Text style={{ fontSize: 10, marginBottom: 5 }}>For,</Text>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 15 }}>Phoneme Solutions Pvt. Ltd.</Text>

        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginBottom: 5 }}>
          {displayName.toUpperCase()}
        </Text>

        {hasSignatureImage && (
          <Image
            src={signatorySignature}
            style={{ width: 100, height: 50, objectFit: 'contain', marginBottom: 5 }}
          />
        )}
        {!hasSignatureImage && (
          <View style={{ marginTop: 5, marginBottom: 10 }}>
            <Text style={{ fontFamily: 'Helvetica-Oblique', fontSize: 14 }}>{displayName}</Text>
          </View>
        )}

        <Text style={{ fontSize: 10, marginBottom: 20 }}>{displayTitle}</Text>

        <Text style={{ fontSize: 10 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>Encl:</Text> Annexure - A (compensation structure)
        </Text>
      </View>

      {/* Acknowledgement Section */}
      <View style={{ marginTop: 40 }}>
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginBottom: 15 }}>ACKNOWLEDGEMENT</Text>
        <Text style={{ fontSize: 10, marginBottom: 20, lineHeight: 1.4 }}>
          This is to certify that I have read this Agreement and all Annexure and understood all the terms and conditions mentioned therein and I hereby accept and agree to abide by them:
        </Text>

        {/* Name and Date Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <View style={{ width: '45%' }}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>Name of Employee:</Text>
              <Text style={{ fontSize: 10, marginLeft: 10 }}>{candidateName || '_________________'}</Text>
            </View>
          </View>
          <View style={{ width: '45%' }}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>Date:</Text>
              <Text style={{ fontSize: 10, marginLeft: 10 }}>____/____/________</Text>
            </View>
          </View>
        </View>

        {/* Signature and Place Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <View style={{ width: '45%' }}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>Signature of Employee:</Text>
              <Text style={{ fontSize: 10, marginLeft: 10 }}>_________________</Text>
            </View>
          </View>
          <View style={{ width: '45%' }}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>Place:</Text>
              <Text style={{ fontSize: 10, marginLeft: 10 }}>_________________</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

interface AnnexureAProps {
  salaryBreakdown: SalaryComponent[];
  candidateName: string;
}

export function AnnexureA({ salaryBreakdown, candidateName }: AnnexureAProps) {
  const totalPerMonth = salaryBreakdown.reduce((sum, item) => sum + item.perMonth, 0);
  const totalAnnual = salaryBreakdown.reduce((sum, item) => sum + item.annual, 0);

  return (
    <View>
      <Text style={styles.annexureTitle}>ANNEXURE- A</Text>
      <Text style={styles.annexureSubtitle}>Salary Break Up</Text>
      <Text style={styles.textBold}>Candidate Name: {candidateName}</Text>

      {/* Salary Table */}
      <View style={styles.table}>
        {/* Header Row */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={styles.tableCellHeader}>Components</Text>
          <Text style={styles.tableCellHeader}>Per Month (in Rs.)</Text>
          <Text style={styles.tableCellHeaderLast}>Annual (in Rs.)</Text>
        </View>

        {/* Data Rows */}
        {salaryBreakdown.map((row, index) => (
          <View
            key={index}
            style={
              index === salaryBreakdown.length - 1 && totalPerMonth > 0
                ? styles.tableRowLast
                : styles.tableRow
            }
          >
            <Text style={styles.tableCell}>{row.component}</Text>
            <Text style={styles.tableCellRight}>
              {row.perMonth.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text style={styles.tableCellRightLast}>
              {row.annual.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        ))}

        {/* Total Row */}
        {salaryBreakdown.length > 0 && (
          <View style={[styles.tableRow, styles.tableTotal]}>
            <Text style={styles.tableCellBold}>Fixed Salary (Total)</Text>
            <Text style={[styles.tableCellBold, { textAlign: 'right' }]}>
              {totalPerMonth.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text style={[styles.tableCellBold, { textAlign: 'right' }]}>
              {totalAnnual.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        )}
      </View>
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 }}>
          Conveyance charges will be 4Rs /km for the official meetings.
        </Text>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>•</Text>
          <Text style={styles.listContent}>
            Fixed Salary: ₹{totalPerMonth.toLocaleString('en-IN')} per month
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>•</Text>
          <Text style={styles.listContent}>
            In addition to the above salary, you will also be eligible for performance-based incentives depending on your performance and overall contribution to the project.
          </Text>
        </View>
      </View>
    </View>
  );
}

interface ListItemProps {
  number: number;
  text: string;
}

export function ListItem({ number, text }: ListItemProps) {
  return (
    <View style={styles.listItem}>
      <Text style={styles.listNumber}>{number}.</Text>
      <Text style={styles.listContent}>{text}</Text>
    </View>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface NumberedSectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

export function NumberedSection({ number, title, children }: NumberedSectionProps) {
  return (
    <View style={styles.numberedSection}>
      <Text style={styles.numberedHeading}>
        {number}. {title}
      </Text>
      {children}
    </View>
  );
}

interface SecondarySignatureSectionProps {
  signatoryName: string;
  signatoryPosition: string;
  signatorySignature?: string;
  signatoryStamp?: string;
}

export function SecondarySignatureSection({
  signatoryName,
  signatoryPosition,
  signatorySignature,
  signatoryStamp,
}: SecondarySignatureSectionProps) {
  const hasSignatureImage = signatorySignature && signatorySignature.startsWith('data:');
  const hasStampImage = signatoryStamp && signatoryStamp.startsWith('data:');

  return (
    <View style={{ marginTop: 40 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        {/* Right side - Secondary Signatory */}
        <View style={{ width: '48%', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Authorized Signatory</Text>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>For Phoneme Solutions Private Limited.</Text>

          {hasSignatureImage && (
            <Image
              src={signatorySignature}
              style={{ width: 120, height: 60, objectFit: 'contain', marginTop: 5, marginBottom: 5 }}
            />
          )}
          {!hasSignatureImage && (
            <View style={{ marginTop: 20, marginBottom: 5 }}>
              <Text>____________________</Text>
            </View>
          )}

          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 5 }}>{signatoryName}</Text>
          <Text style={{ fontSize: 10, marginTop: 2 }}>{signatoryPosition}</Text>

          {hasStampImage && (
            <Image
              src={signatoryStamp}
              style={{ width: 100, height: 100, objectFit: 'contain', marginTop: 10 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// Dual Signature Section - Both HR and Director signatures (MANDATORY for last page)
interface DualSignatureSectionProps {
  hrSignatory?: {
    name?: string;
    position?: string;
    signature?: string;
    stamp?: string;
  } | null;
  directorSignatory?: {
    name?: string;
    position?: string;
    signature?: string;
    stamp?: string;
  } | null;
  hrManagerName: string;
  hrManagerTitle: string;
}

export function DualSignatureSection({
  hrSignatory,
  directorSignatory,
  hrManagerName,
  hrManagerTitle,
}: DualSignatureSectionProps) {
  const hasHRSignature = hrSignatory?.signature && hrSignatory.signature.startsWith('data:');
  const hasDirectorSignature = directorSignatory?.signature && directorSignatory.signature.startsWith('data:');
  const hasDirectorStamp = directorSignatory?.stamp && directorSignatory.stamp.startsWith('data:');

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 }}>
      {/* HR Signature (Left side) */}
      <View style={{ width: '45%' }}>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>For Phoneme Solutions Private Limited.</Text>

        {hasHRSignature ? (
          <Image
            src={hrSignatory!.signature!}
            style={{ width: 120, height: 60, objectFit: 'contain', marginTop: 5, marginBottom: 5 }}
          />
        ) : (
          <View style={{ marginTop: 20, marginBottom: 5 }}>
            <Text>____________________</Text>
          </View>
        )}

        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 5 }}>
          {hrSignatory?.name || hrManagerName}
        </Text>
        <Text style={{ fontSize: 10, marginTop: 2 }}>
          {hrSignatory?.position || hrManagerTitle}
        </Text>
      </View>

      {/* Director Signature (Right side) - MANDATORY */}
      <View style={{ width: '45%' }}>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Authorized Signatory</Text>

        {hasDirectorSignature ? (
          <Image
            src={directorSignatory!.signature!}
            style={{ width: 120, height: 60, objectFit: 'contain', marginTop: 5, marginBottom: 5 }}
          />
        ) : (
          <View style={{ marginTop: 20, marginBottom: 5 }}>
            <Text>____________________</Text>
          </View>
        )}

        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 5 }}>
          {directorSignatory?.name || 'Director'}
        </Text>
        <Text style={{ fontSize: 10, marginTop: 2 }}>
          {directorSignatory?.position || 'Director'}
        </Text>

        {hasDirectorStamp && (
          <Image
            src={directorSignatory!.stamp!}
            style={{ width: 80, height: 80, objectFit: 'contain', marginTop: 10 }}
          />
        )}
      </View>
    </View>
  );
}

// Annexure B - Key Responsibility Areas (KRA)
interface AnnexureBProps {
  designation: string;
  kraDetails: KRADetail[];
}

export function AnnexureB({ designation, kraDetails }: AnnexureBProps) {
  if (!kraDetails || kraDetails.length === 0) {
    return null;
  }

  return (
    <View>
      <Text style={styles.annexureTitle}>ANNEXURE- B</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 20 }}>
        Key Responsibility Areas (KRA) – {designation}
      </Text>

      {kraDetails.map((kra, index) => (
        <View key={index} style={styles.kraListItem}>
          <Text style={styles.kraListNumber}>{index + 1}.</Text>
          <Text style={styles.kraListContent}>{kra.responsibility}</Text>
        </View>
      ))}
    </View>
  );
}

// Acknowledgement Section
interface AcknowledgementSectionProps {
  candidateName?: string;
}

export function AcknowledgementSection({ candidateName }: AcknowledgementSectionProps) {
  return (
    <View style={{ marginTop: 40 }}>
      <Text style={styles.acknowledgementTitle}>ACKNOWLEDGEMENT</Text>
      <Text style={styles.acknowledgementText}>
        This is to certify that I have read this Agreement and all Annexure and understood all the terms and conditions mentioned therein and I hereby accept and agree to abide by them:
      </Text>

      {/* Name and Date Row */}
      <View style={styles.acknowledgementRow}>
        <View style={styles.acknowledgementField}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={styles.acknowledgementLabel}>Name of Employee:</Text>
            <Text style={{ fontSize: 10, marginLeft: 10, flex: 1 }}>{candidateName || '_________________'}</Text>
          </View>
        </View>
        <View style={styles.acknowledgementField}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={styles.acknowledgementLabel}>Date:</Text>
            <Text style={{ fontSize: 10, marginLeft: 10 }}>____/____/________</Text>
          </View>
        </View>
      </View>

      {/* Signature and Place Row */}
      <View style={styles.acknowledgementRow}>
        <View style={styles.acknowledgementField}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={styles.acknowledgementLabel}>Signature of Employee:</Text>
            <Text style={{ fontSize: 10, marginLeft: 10, flex: 1 }}>_________________</Text>
          </View>
        </View>
        <View style={styles.acknowledgementField}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={styles.acknowledgementLabel}>Place:</Text>
            <Text style={{ fontSize: 10, marginLeft: 10, flex: 1 }}>_________________</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Final Page Signature Section - HR Signature with Acknowledgement below
interface FinalPageSignatureProps {
  hrManagerName: string;
  hrManagerTitle: string;
  signatoryName?: string;
  signatoryPosition?: string;
  signatorySignature?: string;
  candidateName?: string;
}

export function FinalPageSignatureSection({
  hrManagerName,
  hrManagerTitle,
  signatoryName,
  signatoryPosition,
  signatorySignature,
  candidateName,
}: FinalPageSignatureProps) {
  const hasSignatory = signatoryName && signatoryPosition;
  const displayName = hasSignatory ? signatoryName : hrManagerName;
  const displayTitle = hasSignatory ? signatoryPosition : hrManagerTitle;
  const hasSignatureImage = signatorySignature && signatorySignature.startsWith('data:');

  return (
    <View>
      {/* Closing Text */}
      <Text style={{ fontSize: 10, fontStyle: 'italic', marginBottom: 20 }}>
        We welcome you to Phoneme Solutions Pvt Ltd. and look forward to a long and mutually beneficial relationship.
      </Text>
      <Text style={{ fontSize: 10, fontStyle: 'italic', marginBottom: 30 }}>
        Please confirm your acceptance of our offer by signing and returning the duplicate copy of this letter.
      </Text>

      {/* HR Signature */}
      <Text style={{ fontSize: 10, marginBottom: 5 }}>For,</Text>
      <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 15 }}>Phoneme Solutions Pvt. Ltd.</Text>

      <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginBottom: 5 }}>
        {displayName.toUpperCase()}
      </Text>

      {hasSignatureImage && (
        <Image
          src={signatorySignature}
          style={{ width: 100, height: 50, objectFit: 'contain', marginBottom: 5 }}
        />
      )}
      {!hasSignatureImage && (
        <View style={{ marginTop: 10, marginBottom: 10 }}>
          <Text>____________________</Text>
        </View>
      )}

      <Text style={{ fontSize: 10, marginBottom: 30 }}>{displayTitle}</Text>

      {/* Enclosure */}
      <Text style={{ fontSize: 10 }}>
        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Encl:</Text> Annexure - A (compensation structure)
      </Text>

      {/* Acknowledgement Section */}
      <AcknowledgementSection candidateName={candidateName} />
    </View>
  );
}
