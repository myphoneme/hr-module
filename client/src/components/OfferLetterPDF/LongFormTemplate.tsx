import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import {
  LetterHeader,
  PageFooter,
  SignatureSection,
  AnnexureA,
  AnnexureB,
  AcknowledgementSection,
  type LetterheadData,
} from './SharedComponents';
import type { KRADetail } from '../../types';

interface LongFormTemplateProps {
  letterContent: any;
}

export function LongFormTemplate({ letterContent }: LongFormTemplateProps) {
  const {
    header,
    date,
    referenceNumber,
    to,
    subject,
    body,
    signature,
    signatory,
    annexure,
    annexureB,
    letterhead,
    joiningBonus,
  } = letterContent;

  // Get KRA details from annexureB if available
  const kraDetails: KRADetail[] = annexureB?.responsibilities || [];
  const designationText = subject?.replace('Offer for the post of ', '') || 'the position';

  // Cast letterhead to proper type
  const letterheadData: LetterheadData | null = letterhead || null;

  return (
    <Document>
      {/* Page 1: Opening & Section 1 - Commencement */}
      <Page size="A4" style={styles.page}>
        <LetterHeader showTitle={true} title={header} date={date} letterhead={letterheadData} />

        {/* Reference Number and Date Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{referenceNumber || ''}</Text>
          <Text style={{ fontSize: 10 }}>{date}</Text>
        </View>

        {/* Recipient */}
        <View style={styles.section}>
          <Text style={styles.text}>Dear {to},</Text>
        </View>

        {/* Opening */}
        <View style={styles.section}>
          <Text style={styles.text}>
            On behalf of <Text style={styles.textBold}>Phoneme Solutions Pvt. Ltd.</Text> Based on your applications, interviews & discussions we have had, we are pleased to offer you the position of <Text style={styles.textBold}>{designationText}</Text> at our office in {body.workingLocation || '703-7th Floor Narain Manzil, Barakhamba Road, Connaught Place, New Delhi-110001'}, India.{body.reportingManager ? ` You will be reporting to the ${body.reportingManager} at ${body.reportingLocation || 'Delhi Office'}.` : ''} Your employment with us shall be governed by the following terms and conditions. This offer will be valid till the Date of Joining <Text style={styles.textBold}>{body.offerValidDate}</Text>.
          </Text>
        </View>

        {/* Section 1: Commencement of Appointment */}
        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>1. COMMENCEMENT OF APPOINTMENT:</Text>
          <Text style={styles.text}>
            Your appointment is effective from the date of joining which shall be not later than <Text style={styles.textBold}>{body.joiningDate}</Text>. On the date of your joining, you are required to handover previous companies relieving letter & conduct certificate, before signing the hardcopy of this offer letter in order to complete the onboarding process headquartered at <Text style={styles.textBold}>Phoneme Solutions Pvt. Ltd.</Text> {body.joiningLocation || '703-7th Floor Narain Manzil, Barakhamba Road, Connaught Place, New Delhi-110001'}, India. Please note that if at any point in time, the Company is of the opinion that the documents provided are false or your background verification is not satisfactory, your employment may be terminated with immediate effect.
          </Text>
          <Text style={styles.text}>
            During your period of employment, your Annual CTC will be <Text style={styles.textBold}>Rs. {body.ctcFormatted}/- ({body.ctcInWords}) Per Annum</Text>. For detailed breakup please refer to Annexure A.
          </Text>
          <Text style={styles.textSmall}>
            Note: - "Subject to Deduction of contributions, charges and taxes at source as per the Laws/Acts of Government of India, as may be applicable from time to time".
          </Text>
          <Text style={styles.text}>
            Your employment is subject to the terms and conditions set forth in this offer letter and the rules and regulations as set out in the Company's HR policy guidelines:
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>➢</Text>
            <Text style={styles.listContent}>
              Pre-employment and ongoing screening: The Company shall conduct in its sole discretion, background and reference checks and verify your salary and employment history. Your initial and ongoing employment is conditional on the Company being satisfied that the results of the background check are compatible with the inherent requirements of your position in the Company. If in the opinion of the Company, any of your background checks, reference checks, employment history or visas etc. are not satisfactory, then the Company may choose not to commence your employment, or where you have already started, may terminate your employment immediately, with no liability to pay compensation to you for such termination.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>➢</Text>
            <Text style={styles.listContent}>
              Termination shall be as per the terms of this agreement and the requirements of applicable law.
            </Text>
          </View>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 2: Section 2 - Terms and Conditions */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>2. TERMS AND CONDITIONS OF EMPLOYMENT:</Text>
          <Text style={styles.text}>
            You shall be required to work as per the requirements of the Company/Company's client and your duties may vary depending upon the requirement of the Company's Client from time to time.
          </Text>

          <Text style={styles.heading3}>Duties:</Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>i.</Text>
            <Text style={styles.listContent}>
              You acknowledge that, depending on its needs (including, the needs of the Group) the Company may at its sole discretion change your designation and responsibilities, and you agree to serve the Company in such assigned capacities consistent with your position in the Company.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>ii.</Text>
            <Text style={styles.listContent}>
              During the course of employment, you shall:
            </Text>
          </View>
          <View style={{ marginLeft: 30 }}>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>a.</Text>
              <Text style={styles.listContent}>
                Diligently, faithfully and to the best of your skill and ability perform and discharge all the duties and functions entrusted to you by the Company.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>b.</Text>
              <Text style={styles.listContent}>
                In addition to the terms and conditions of employment set out herein, adhere to all rules, regulations, Policies, procedures, guidelines and other such items applicable to your work that the Company may from time-to-time frame/revise/update for observance and compliance by you and the other employees.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>c.</Text>
              <Text style={styles.listContent}>
                Be aware that a violation of any such Policies, procedures and guidelines by you could lead to disciplinary actions, including termination of your employment.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>d.</Text>
              <Text style={styles.listContent}>
                Obey and comply with all lawful orders and directions given by the Company or by any person duly authorized on that behalf and faithfully obey all such rules, regulations and arrangements.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>e.</Text>
              <Text style={styles.listContent}>
                Use all the knowledge, skill and experience that you possess to the best satisfaction of the Company.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>f.</Text>
              <Text style={styles.listContent}>
                Not make any false, defamatory or disparaging statements about the Company and/or its Group Companies, or the employees, officers or directors of the Company and/or its Group Companies.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>g.</Text>
              <Text style={styles.listContent}>
                Inform the Company at once of any act of dishonesty and/or any action prejudicial to the interest of the Company, by any person, which may come to your knowledge.
              </Text>
            </View>
          </View>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 3: Section 2 continued & Section 3 - Salary */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        <View style={styles.numberedSection}>
          <Text style={styles.text}>
            For the purpose of these terms and conditions, "Group Companies" or "Group" shall mean the Company and:
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>i.</Text>
            <Text style={styles.listContent}>Any company or other person that directly or indirectly controls the Company; or</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>ii.</Text>
            <Text style={styles.listContent}>Any company or other person which is directly or indirectly controlled by the Company; or</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>iii.</Text>
            <Text style={styles.listContent}>Any company or other person which is under the common control of the same person who controls the Company.</Text>
          </View>
          <Text style={styles.text}>
            Policies, procedures, rules and code: You agree that during your course of employment with the Company, you shall comply with the Company's policies and procedures, rules and codes in place and any client-related policies as applicable from time to time.
          </Text>
        </View>

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>3. SALARY:</Text>
          <Text style={styles.text}>
            You will be eligible for company benefits which are detailed as part of your compensation structure in Annexure-A, attached along with this letter. Your basic salary will be paid according to standard payroll practices, subject to any tax or other deduction provided or permitted by law in force from time to time, such as the employee's share of provident fund contributions if applicable, as well as such other sums as may be agreed with you from time to time. Your fixed salary may be reviewed from time to time in accordance with Company policy but will not necessarily be increased and is paid for in satisfying all the services rendered by you under this agreement, including overtime, to the extent permitted by law. You are encouraged to independently verify the tax implications on your salary. The taxable and non-taxable components of your salary may vary based on the prevailing law as amended from time to time.
          </Text>
          <Text style={styles.heading3}>Confidentiality:</Text>
          <Text style={styles.text}>
            Your salary/benefit-related details are strictly confidential, and the Company requires that you should not reveal/disclose the same. You shall not indulge in matters pertaining to the salary of others in the Company. During the course of your employment with the Company or at any time thereafter, divulge or disclose to any person whomsoever makes any use whatsoever for your own purpose or for any other purpose other than that of the Company, of any information or knowledge obtained by you during your employment as to the business or affairs of the company including development, process reports and reporting system and you.
          </Text>
          <Text style={styles.heading3}>Exclusivity:</Text>
          <Text style={styles.text}>
            Your position is a whole-time employment with the Company, and you shall devote yourself exclusively to the business of the company. You will not take up any other work for remuneration or work in an advisory capacity or be interested directly or indirectly in any other trade or business during employment with the Company without prior approval in writing from the Company's management.
          </Text>
          <Text style={styles.text}>
            The Employee will be reimbursed for all reasonable expenses properly and necessarily incurred by the Employee in the performance of the Employee's Duties that are pre-approved by the Company and in accordance with the Company's policy on payment of expenses and upon submission of appropriate documentation.
          </Text>
          <Text style={styles.text}>
            If the Employee becomes indebted to the Company for any reason, the Company may, if it so elects, set off the whole or part of such outstanding amount from any amount due and payable by it to the Employee (by way of remuneration or otherwise).
          </Text>
          <Text style={styles.heading3}>Joining Bonus (if applicable):</Text>
          {joiningBonus ? (
            <Text style={styles.text}>
              Joining Bonus (if applicable) is a one-time payment, which is payable according to the offer terms provided in Annexure – A, and is payable on the completion of and your continued employment for a minimum period of 90 days from the date of joining. In the event of your separation from the Company (Resignation or Termination due to any reasons) before the completion of 1(one) year from the date of joining, then the entire Joining bonus paid by the Company shall be returned by you to the Company, which the Company may also set off from any amount due and payable by it to the Employee (by way of remuneration or otherwise).
            </Text>
          ) : (
            <Text style={styles.text}>
              Joining Bonus (if applicable) is a one-time payment, which is payable according to the offer terms provided in Annexure – A, and is payable on the completion of and your continued employment for a minimum period of 90 days from the date of joining. In the event of your separation from the Company (Resignation or Termination due to any reasons) before the completion of 1(one) year from the date of joining, then the entire Joining bonus paid by the Company shall be returned by you to the Company, which the Company may also set off from any amount due and payable by it to the Employee (by way of remuneration or otherwise).
            </Text>
          )}
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 4: Section 4 - Probation & Section 5 - Leave Policy */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>4. PROBATIONARY PERIOD:</Text>
          <Text style={styles.text}>
            From the date of your employment with Phoneme Solutions Pvt. Ltd. you shall initially be on probation for a period of six (6) months ("Probation Period") from the date of joining, during which your performance will be monitored by the Company. Your Employment will be confirmed at the completion of this period and the Company shall communicate the same to you in writing. However, if there is any change, the same will be communicated on or before the end of this probation period in writing. The Probation Period may be extended for a further period of 3 months by the Company at its sole discretion, keeping in view your performance.
          </Text>
          <Text style={styles.text}>
            It is hereby clarified that the Employee will not be deemed as confirmed at completion of the Probationary Period unless the Company communicates the same to the Employee in writing and if you are a confirmed employee this clause along with the termination on probation will not have any effect.
          </Text>
        </View>

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>5. LEAVE POLICY:</Text>
          <Text style={styles.text}>
            You will be entitled to leave in accordance with the Company's leave policy in the place where the employee is deployed from time to time, subject to applicable law. Absence from work, for whatever reason, must be notified to the Company as soon as possible on the first day of absence.
          </Text>
          <Text style={styles.text}>
            An absence for three (3) consecutive business days without prior permission will be treated as an unauthorized absence from work. In such a case, the Company is entitled to terminate your services and/or seek compensation for any loss suffered by the Company or the Company's client due to such an absence.
          </Text>
        </View>

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>6. TERMINATION & NOTICE PERIOD:</Text>
          <Text style={styles.heading3}>Termination during the Probationary Period:</Text>
          <Text style={styles.text}>
            Either Party will be at liberty to terminate your engagement with the Company at any time without assigning any reason whatsoever by means of a Fifteen (15) days' notice period of termination in writing or 15 (Fifteen) days' salary in lieu thereof.
          </Text>
          <Text style={styles.heading3}>Termination by Either Party:</Text>
          <Text style={styles.text}>
            During the probationary period and on confirmation of your services in the Company, your employment/engagement of services with the Company may be terminable by either Party by giving 30 days' notice in writing or payment in lieu thereof.
          </Text>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 5: Section 6 continued */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        <View style={styles.numberedSection}>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>➢</Text>
            <Text style={styles.listContent}>
              If, however, you are on a particular project/assignment, which requires your completion of the same, the Company may insist upon you serve an additional notice period which shall not exceed an additional period of 30 days. The Company has the sole discretion to waive/reduce the notice period or receipt of payment in lieu thereof on the termination of your employment in terms of this Clause. Further for such a period, when the notice period is waived, the employer shall not be liable to pay you salary.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>➢</Text>
            <Text style={styles.listContent}>
              Termination due to misconduct (without notice): Without prejudice to any of the rights and remedies which the Company may have against you, the Company will be entitled to terminate your employment/engagement (at its sole discretion), without notice and without any monetary liability, including payment in lieu of notice, and without prejudice to any other legal action that the Company may initiate, in case of you/employee having furnished false information or withheld pertinent information regarding your past service and records, any disobedience, fraud, theft, indiscipline, insubordination, incivility, insobriety, dishonesty, misappropriation, breach of the Confidential Information obligations, habitual absence without approved leaves, non-performance on the part of your employment, breach of the terms hereof, or any other serious act of misconduct or negligence on your part.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>➢</Text>
            <Text style={styles.listContent}>
              You agree that, you shall serve the required notice period in accordance with the terms of this Agreement, unless the said notice period is waived by the Company in writing, and that you will continue to be engaged by the Company and the terms and conditions of this Agreement shall be binding on you until the expiry of such notice period. In the event of breach/attempted breach by you of the notice period and/or any of the other provisions of this Agreement, in addition to the remedies available to the Company under this Agreement, you agree that the Company would also be entitled to pursue any other remedies available under applicable laws, including specifically enforcing the said notice period or obtaining an injunction to prevent you from joining any other employment prior to the expiry of the agreed notice.
            </Text>
          </View>
          <Text style={styles.heading3}>On Deputation:</Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>➢</Text>
            <Text style={styles.listContent}>
              In the event that you want to terminate your employment with the Company, while on a project at a customer's site in India or abroad you will require to give a minimum of 90 days' notice, to enable a smooth transition and knowledge transfer. The relieving date will be mutually decided with the consent of the concerned client and your superior reporting manager of the Company.
            </Text>
          </View>
          <Text style={styles.heading3}>Separation and release:</Text>
          <Text style={styles.text}>
            Upon termination of your employment with the Company for any reason, the Company may require you to sign a separation and release agreement with the Company. You shall sign this and any other agreements and confirmations that the Company may require.
          </Text>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 6: Section 7 - Conflict of Interest */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>7. CONFLICT OF INTEREST & NON-SOLICITATION:</Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>➢</Text>
            <Text style={styles.listContent}>
              During your performance of services for the Company, you shall not engage in any other employment, occupation, consultation, or other activity that relates to any actual or anticipated business, research, development, product, service or activity of the Company, or that otherwise conflicts with your obligations to the Company, without obtaining the specific prior written permission of the Company. If such permission is given and a conflict later develops, you understand and agree that the Company may require you to cease the performance of services for the Company and refrain from such other employment, occupation, consultation, or other activity.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>➢</Text>
            <Text style={styles.listContent}>
              Certain activities or interests may conflict with your obligations to the Company. These activities and interests include but are not limited to:
            </Text>
          </View>
          <View style={{ marginLeft: 20 }}>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>i.</Text>
              <Text style={styles.listContent}>
                Any outside business interest including non-company work (paid or unpaid), business ventures, directorships, partnerships or a direct or indirect financial interest that has the potential to be in conflict with your employment, the interests of the Company or Company's partners, customers or suppliers; or
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>ii.</Text>
              <Text style={styles.listContent}>
                Engaging in any activity that might compete directly or indirectly with the Company or might pose a conflict of interest with your employment; or
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.listNumber}>iii.</Text>
              <Text style={styles.listContent}>
                Having or gaining an interest including a direct or indirect financial interest (for example, ownership of shares or ownership or investment in an outside business), which might pose a conflict of interest with your employment.
              </Text>
            </View>
          </View>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 7: Section 8 - Confidentiality */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>8. CONFIDENTIALITY:</Text>
          <Text style={styles.text}>
            You shall hold strict confidence and shall not, without specific prior written authorization from the Company, use or disclose to anyone outside the Company (except as necessary to perform your duties), any Proprietary Information.
          </Text>
          <Text style={styles.text}>
            "Proprietary Information" means and includes all non-public information of any nature that the Company considers to be proprietary or confidential, including (but not limited to) all research, products, services, suppliers, markets, processes, licenses, budgets, Inventions, marketing plans, product plans, business strategies, financial information, sales forecasts, personnel information, and customer lists.
          </Text>
          <Text style={styles.text}>
            "Inventions" means and includes ideas, inventions, discoveries, works of authorship, formulas, algorithms, designs, specifications, methods, processes, techniques, trade secrets, know-how, software programs, databases, user interfaces, and documentation.
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              You agree to keep confidential information whether during your employment with the Company or after the termination of employment.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              You shall not make copies/reproduce/remove any documents or tangible items that belong to the Company, or which contain any Confidential Information from the premises of the Company without any valid reason and prior authorization.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              If you leave the employment of the Company, the Employee hereby grants consent to the Company to notify your new/future employer about the Employee's confidentiality and other obligations under this Agreement.
            </Text>
          </View>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 8: Section 9 - Intellectual Property */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>9. INTELLECTUAL PROPERTY & ASSIGNMENT:</Text>
          <Text style={styles.text}>
            During the course of your employment, if you conceive of any new or advanced methods, inventions, designs or improvements, processes/systems in relation to the operation of the Company, all such developments shall be communicated to the Company and shall be and remain the sole right/property of the Company and you shall execute documents and do all things necessary to enable the Company to obtain all rights to the same.
          </Text>
          <Text style={styles.text}>
            You hereby agree and assign to the Company, your entire right, title, and interest (including all patent rights, copyrights, trade secret rights, and other applicable intellectual property rights) in all Inventions made or conceived by you (whether alone or jointly with others) relating to development services performed for the Company or relating to any Proprietary Information supplied to you by the Company.
          </Text>
          <Text style={styles.text}>In connection with all Company Inventions:</Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>a)</Text>
            <Text style={styles.listContent}>
              You will, both during and after your performance of development services for the Company, at the Company's request, promptly execute one or more specific irrevocable assignments of title to the Company, and do whatever else is deemed necessary or advisable by the Company, to secure, perfect, and maintain patent rights, copyrights, trade secret rights, in India and foreign countries.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>b)</Text>
            <Text style={styles.listContent}>
              You hereby irrevocably transfer and assign to the Company any and all "Moral Rights" that you may have in or with respect to any Company Invention. You also hereby forever waive and agree never to assert any and all Moral Rights that you may have.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>c)</Text>
            <Text style={styles.listContent}>
              You acknowledge that any Company Invention that constitutes an original work of authorship is "Work made for hire," and that the Company owns all copyrights for such work.
            </Text>
          </View>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 9: Section 10 - Miscellaneous & Acceptance */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        <View style={styles.numberedSection}>
          <Text style={styles.numberedHeading}>10. MISCELLANEOUS:</Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              You have been appointed on the basis of the particulars submitted by you. If at any time, it emerges that such particulars were false or incorrect or that any material or relevant information has been suppressed, your appointment would be liable to be terminated.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              This agreement constitutes the entire understanding between the parties relating to your employment with the Company.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              No waiver of any breach of the terms and conditions shall be a waiver of any other or subsequent breach of the same or any other clause contained herein.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              This Agreement, the Annexure and any other documents referred to herein constitute the whole agreement between the parties and supersede any previous arrangement or agreement, whether written or oral.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              If any provision of this Agreement is held by any court to be void or unenforceable, such provision shall be modified or eliminated, but the remaining provisions shall remain in full force and effect.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              This agreement shall be governed by and construed in accordance with the Laws in force in India and both the parties hereby agree to the exclusive jurisdiction of the courts at Noida, Uttar Pradesh.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontSize: 10, fontStyle: 'italic', marginBottom: 10 }}>
            We welcome you to Phoneme Solutions Pvt Ltd. and look forward to a long and mutually beneficial relationship.
          </Text>
          <Text style={{ fontSize: 10, fontStyle: 'italic', marginBottom: 20 }}>
            Please confirm your acceptance of our offer by signing and returning the duplicate copy of this letter.
          </Text>
        </View>

        {/* Signature Section - HR Signature with Acceptance */}
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

      {/* Page 10: Annexure A - Salary Breakup */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />
        <AnnexureA salaryBreakdown={annexure.table} candidateName={to} />

        {/* Additional notes */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300', marginBottom: 10 }}>
            Conveyance charges will be 4Rs /km for the official meetings.
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              Fixed Salary: ₹{Math.round(annexure.table.reduce((sum: number, item: any) => sum + (item.perMonth || 0), 0)).toLocaleString('en-IN')} per month
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>•</Text>
            <Text style={styles.listContent}>
              In addition to the above salary, you will also be eligible for performance-based incentives depending on your performance and overall contribution to the project.
            </Text>
          </View>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>

      {/* Page 11: Annexure B - KRA (only if KRA details exist) with Signature and Acknowledgement */}
      {kraDetails.length > 0 && (
        <Page size="A4" style={styles.page}>
          <LetterHeader letterhead={letterheadData} />
          <AnnexureB
            designation={designationText}
            kraDetails={kraDetails}
          />
          <PageFooter letterhead={letterheadData} />
        </Page>
      )}

      {/* Final Page: Signature and Acknowledgement */}
      <Page size="A4" style={styles.page}>
        <LetterHeader letterhead={letterheadData} />

        {/* HR Signature Section */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 15 }}>For Phoneme Solutions Pvt. Ltd.</Text>

          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginBottom: 5 }}>
            {(signatory?.name || signature.name).toUpperCase()}
          </Text>

          {signatory?.signature && signatory.signature.startsWith('data:') ? (
            <View style={{ marginBottom: 5, height: 40 }}>
              {/* Signature placeholder */}
            </View>
          ) : (
            <View style={{ marginTop: 10, marginBottom: 10 }}>
              <Text style={{ fontFamily: 'Helvetica-Oblique', fontSize: 14 }}>{signatory?.name || signature.name}</Text>
            </View>
          )}

          <Text style={{ fontSize: 10, marginBottom: 40 }}>{signatory?.position || signature.title}</Text>
        </View>

        {/* Acknowledgement */}
        <AcknowledgementSection candidateName={to} />

        <PageFooter letterhead={letterheadData} />
      </Page>
    </Document>
  );
}
