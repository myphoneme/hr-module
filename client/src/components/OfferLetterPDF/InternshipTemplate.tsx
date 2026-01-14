import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import {
  LetterHeader,
  PageFooter,
  RecipientSection,
  SignatureSection,
  AnnexureA,
  ListItem,
  Section,
  SecondarySignatureSection,
  type LetterheadData,
} from './SharedComponents';

interface InternshipTemplateProps {
  letterContent: any;
}

/**
 * Internship Offer Letter Template (2-3 pages)
 * Simplified version for internship positions
 */
export function InternshipTemplate({ letterContent }: InternshipTemplateProps) {
  const {
    header,
    date,
    to,
    address,
    subject,
    body,
    signature,
    signatory,
    annexure,
    letterhead,
  } = letterContent;

  // Cast letterhead to proper type
  const letterheadData: LetterheadData | null = letterhead || null;

  return (
    <Document>
      {/* Page 1: Main Terms */}
      <Page size="A4" style={styles.page}>
        <LetterHeader showTitle={true} title={header} date={date} letterhead={letterheadData} />

        <RecipientSection name={to} address={address} subject={subject} />

        <View style={styles.section}>
          <Text style={styles.textBold}>{body.greeting}</Text>
          <Text style={styles.textBold}>{body.congratulations}</Text>
          <Text style={styles.text}>{body.opening}</Text>
        </View>

        {/* Internship Duration */}
        <View style={styles.section}>
          <Text style={styles.textBold}>Internship Duration:</Text>
          <Text style={styles.text}>
            Your internship will commence on {body.commencement?.split('Your joining date is ')[1] || 'the specified date'} and
            will be for a period of {letterContent.internshipDuration || '3 months'}.
          </Text>
        </View>

        {/* Stipend */}
        <View style={styles.section}>
          <Text style={styles.textBold}>{body.remuneration}</Text>
          <Text style={styles.textSmall}>
            The stipend will be paid on a monthly basis, subject to deduction of taxes at source as applicable.
          </Text>
        </View>

        {/* Working Hours */}
        <View style={styles.section}>
          <Text style={styles.textBold}>{body.workingHours}</Text>
        </View>

        {/* Learning Objectives */}
        <View style={styles.section}>
          <Text style={styles.textBold}>Learning Objectives:</Text>
          <Text style={styles.text}>
            During your internship, you will be working on {letterContent.learningArea || 'software development'} projects
            under the guidance of our experienced team members. You will gain hands-on experience and practical knowledge
            in your field of study.
          </Text>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 2: Terms and Conditions */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        {/* General Terms */}
        <Section title="General Terms:">
          <ListItem
            number={1}
            text="This is an internship position and does not guarantee permanent employment upon completion."
          />
          <ListItem
            number={2}
            text="You will be required to maintain confidentiality of all company information and projects you work on during your internship."
          />
          <ListItem
            number={3}
            text="You are expected to maintain professional conduct and adhere to company policies and guidelines."
          />
          <ListItem
            number={4}
            text="The company reserves the right to terminate the internship with one week's notice if your performance is found unsatisfactory."
          />
          <ListItem
            number={5}
            text="Upon completion of the internship, you will receive an internship completion certificate, subject to satisfactory performance."
          />
        </Section>

        {/* Confidentiality */}
        <Section title="Confidentiality:">
          <Text style={styles.text}>
            You agree to maintain confidentiality of all proprietary information, including but not limited to
            technical data, business processes, client information, and any other information you may have access
            to during your internship. This obligation continues even after the completion of your internship.
          </Text>
        </Section>

        {/* Intellectual Property */}
        <Section title="Intellectual Property:">
          <Text style={styles.text}>
            Any work product, code, designs, or other materials created by you during the internship shall be
            the sole property of Phoneme Solutions Private Limited.
          </Text>
        </Section>

        {/* Acceptance Instructions */}
        <View style={styles.section}>
          <Text style={styles.text}>
            Please sign and return the acceptance copy within 7 days to confirm your participation in this internship program.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.text}>
            We look forward to having you as part of the Phoneme team and wish you a productive learning experience.
          </Text>
        </View>

        {/* Signatures */}
        <SignatureSection
          hrManagerName={signature.name}
          hrManagerTitle={signature.title}
          candidateName={to}
          signatoryName={signatory?.name}
          signatoryPosition={signatory?.position}
          signatorySignature={signatory?.signature}
          signatoryStamp={signatory?.stamp}
        />

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 3: Stipend Breakup (if applicable) */}
      {annexure && annexure.table && annexure.table.length > 0 && (
        <Page size="A4" style={styles.page}>
          <LetterHeader letterhead={letterheadData} />
          <AnnexureA salaryBreakdown={annexure.table} candidateName={to} />

          <PageFooter letterhead={letterheadData} />
        </Page>
      )}
    </Document>
  );
}
