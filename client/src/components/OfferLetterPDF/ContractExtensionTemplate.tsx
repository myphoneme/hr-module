import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import {
  LetterHeader,
  PageFooter,
  RecipientSection,
  SignatureSection,
  AnnexureA,
  SecondarySignatureSection,
  type LetterheadData,
} from './SharedComponents';

interface ContractExtensionTemplateProps {
  letterContent: any;
}

/**
 * Contract Extension Letter Template (2-3 pages)
 * For extending existing employment contracts
 */
export function ContractExtensionTemplate({ letterContent }: ContractExtensionTemplateProps) {
  const {
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
      {/* Page 1: Extension Details */}
      <Page size="A4" style={styles.page}>
        <LetterHeader showTitle={true} title="CONTRACT EXTENSION LETTER" date={date} letterhead={letterheadData} />

        <RecipientSection name={to} address={address} subject={subject} />

        <View style={styles.section}>
          <Text style={styles.textBold}>{body.greeting}</Text>
          <Text style={styles.text}>
            We are pleased to inform you that your employment contract with Phoneme Solutions Private Limited
            is being extended beyond the current end date.
          </Text>
        </View>

        {/* Extension Period */}
        <View style={styles.section}>
          <Text style={styles.textBold}>Extension Period:</Text>
          <Text style={styles.text}>
            Your current contract, which was set to expire on {letterContent.currentEndDate || '[Current End Date]'},
            will be extended until {letterContent.newEndDate || body.commencement?.split('Your joining date is ')[1] || '[New End Date]'}.
          </Text>
        </View>

        {/* Current Designation */}
        <View style={styles.section}>
          <Text style={styles.textBold}>Designation:</Text>
          <Text style={styles.text}>
            You will continue in your current role as {subject.replace('Contract Extension - ', '').replace('Offer for the post of ', '') || '[Designation]'}.
          </Text>
        </View>

        {/* Revised Compensation */}
        <View style={styles.section}>
          <Text style={styles.textBold}>Revised Compensation:</Text>
          <Text style={styles.text}>{body.remuneration}</Text>
          {letterContent.salaryIncreaseNote && (
            <Text style={styles.textSmall}>
              This represents a {letterContent.salaryIncreasePercentage || 'revision'} in your compensation
              in recognition of your valuable contributions.
            </Text>
          )}
          <Text style={styles.textSmall}>{body.salaryNote}</Text>
        </View>

        {/* Working Terms */}
        <View style={styles.section}>
          <Text style={styles.textBold}>Working Hours and Location:</Text>
          <Text style={styles.text}>{body.workingHours}</Text>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 2: Terms and Conditions */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        {/* Continuation of Terms */}
        <View style={styles.section}>
          <Text style={styles.textBold}>Terms and Conditions:</Text>
          <Text style={styles.text}>
            All other terms and conditions of your original employment agreement dated {letterContent.originalContractDate || '[Original Contract Date]'}
            shall continue to apply, except as modified herein. This includes but is not limited to:
          </Text>
        </View>

        {/* Listed Terms */}
        <View style={styles.section}>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>1.</Text>
            <Text style={styles.listContent}>
              Confidentiality obligations and non-disclosure agreements
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>2.</Text>
            <Text style={styles.listContent}>
              Intellectual property assignment and ownership rights
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>3.</Text>
            <Text style={styles.listContent}>
              Non-compete and non-solicitation clauses
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>4.</Text>
            <Text style={styles.listContent}>
              Leave entitlements as per company policy
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>5.</Text>
            <Text style={styles.listContent}>
              Notice period requirements: {body.notice || 'Thirty (30) days'}
            </Text>
          </View>
        </View>

        {/* Performance Expectations */}
        {letterContent.performanceExpectations && (
          <View style={styles.section}>
            <Text style={styles.textBold}>Performance Expectations:</Text>
            <Text style={styles.text}>{letterContent.performanceExpectations}</Text>
          </View>
        )}

        {/* Review Clause */}
        <View style={styles.section}>
          <Text style={styles.textBold}>Future Review:</Text>
          <Text style={styles.text}>
            Your performance will be reviewed before the new contract end date, and any further extension
            will be subject to business requirements and your performance evaluation.
          </Text>
        </View>

        {/* Acceptance */}
        <View style={styles.section}>
          <Text style={styles.text}>
            {body.acceptance || 'Please sign and return the acceptance copy to confirm your agreement to this contract extension.'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.text}>
            We appreciate your continued dedication and look forward to your ongoing contributions to Phoneme Solutions.
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

      {/* Page 3: Revised Salary Breakup */}
      {annexure && annexure.table && annexure.table.length > 0 && (
        <Page size="A4" style={styles.page}>
          <LetterHeader letterhead={letterheadData} />
          <AnnexureA salaryBreakdown={annexure.table} candidateName={to} />

          {/* Director Signature - MANDATORY on last page */}
          <SecondarySignatureSection
            signatoryName={signatory?.name || 'Authorized Signatory'}
            signatoryPosition={signatory?.position || 'Director'}
            signatorySignature={signatory?.signature}
            signatoryStamp={signatory?.stamp}
          />

          <PageFooter letterhead={letterheadData} />
        </Page>
      )}
    </Document>
  );
}
