const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Head → Administration (not a valid dept value)
const employees = [
  { inn: '61004067189', department: 'Administration', job_title: 'გაყიდვების მენეჯერი' },
  { inn: '01012029205', department: 'Administration', job_title: 'უსაფრთხოების მენეჯერი' },
  { inn: '01030049942', department: 'Batumi',         job_title: 'ტექნიკური ინჟინერი ბათუმი' },
  { inn: '18001058845', department: 'Batumi',         job_title: 'ოფის მენეჯრი თბილისი' },
  { inn: '35001112643', department: 'Tbilisi',        job_title: 'ელექტრო ინჟინერი' },
  { inn: '01024085074', department: 'Administration', job_title: 'საიტ მენეჯერი' },
  { inn: '01019058668', department: 'Administration', job_title: 'დირექტორის თანაშემწე' },
  { inn: '01012025656', department: 'Tbilisi',        job_title: 'სერვის ინჟინერი' },
  { inn: '01005026741', department: 'Administration', job_title: 'დრაფტერი' },
  { inn: '01031006443', department: 'Administration', job_title: 'პროექტის მენეჯერი' },
  { inn: '01023012258', department: 'Tbilisi',        job_title: 'სერვის ინჟინერი' },
  { inn: '59001100234', department: 'Tbilisi',        job_title: 'პროექტის მენეჯერი' },
  { inn: '01018002620', department: 'Administration', job_title: 'პროექტის მენეჯერი' },
  { inn: '01007013287', department: 'Administration', job_title: 'გაყიდვების მენეჯრი-თბილისი' },
  { inn: '01011038686', department: 'Administration', job_title: 'საწყობის მენეჯერი' },
  { inn: '01024032465', department: 'Administration', job_title: 'ბუღალტერი' },
  { inn: '01001014120', department: 'Administration', job_title: 'კომერციული დირექტორი' },
  { inn: '01008063825', department: 'Administration', job_title: 'პროექტის მენეჯერი' },
  { inn: '01024029883', department: 'Administration', job_title: 'გაყიდვების მენეჯრი-თბილისი' },
  { inn: '61001080225', department: 'Batumi',         job_title: 'პროექტის მენეჯერი' },
  { inn: '01003013827', department: 'Batumi',         job_title: 'ბათუმის სერვისის ხელმძღვანელი' },
  { inn: '01991027885', department: 'Administration', job_title: 'საბაჟო ოპერაციების მენეჯერი' },
  { inn: '01030020929', department: 'Tbilisi',        job_title: 'ელექტრო ინჟინერი' },
  { inn: '62001030230', department: 'Administration', job_title: 'ტექნიკური კოორდინატორი' },
  { inn: '61001034433', department: 'Administration', job_title: 'ბათუმის მენეჯერი' },
  { inn: '14001028688', department: 'Administration', job_title: 'იურისტი' },
  { inn: '01030009562', department: 'Tbilisi',        job_title: 'გათბობა-კონდიცირების სერვისის თანამშრომელი' },
  { inn: '01024008557', department: 'Administration', job_title: 'დირექტორის პირადი კონსულტანტი' },
  { inn: '61004004589', department: 'Tbilisi',        job_title: 'უსაფრთხოების მენეჯერი' },
  { inn: '35001110621', department: 'Administration', job_title: 'საწყობის მენეჯერი' },
  { inn: '01027025241', department: 'Administration', job_title: 'ბუღალტერი' },
  { inn: '01024007906', department: 'Tbilisi',        job_title: 'უსაფრთხოების მენეჯერი' },
  { inn: '01009020788', department: 'Administration', job_title: 'პროექტის მენეჯერი' },
  { inn: '01024071279', department: 'Administration', job_title: 'შესყიდვების მენეჯერი-თბილისი' },
  { inn: '33001059430', department: 'Batumi',         job_title: 'მომარაგება და საწყობის მენეჯერი' },
  { inn: '62001004570', department: 'Administration', job_title: 'ლოჯისტიკის მენეჯერი' },
  { inn: '61501092738', department: 'Administration', job_title: 'ბუღალტერი' },
  { inn: '01027089573', department: 'Administration', job_title: 'ბუღალტერი' },
  { inn: '01019005894', department: 'Administration', job_title: 'დიასახლისი' },
  { inn: '01012000978', department: 'Administration', job_title: 'მძღოლი' },
  { inn: '35001081763', department: 'Administration', job_title: 'მძღოლი' },
  { inn: '62809013938', department: 'Administration', job_title: 'დიასახლისი' },
  { inn: '61008016577', department: 'Batumi',         job_title: 'სამუშაოთა მწარმოებელი' },
  { inn: '61003003272', department: 'Tbilisi',        job_title: 'გათბობა-კონდიცირების სერვისის თანამშრომელი' },
  { inn: '61005004846', department: 'Batumi',         job_title: 'სერვისის თანამშრომელი ბათუმი' },
  { inn: '61006065553', department: 'Batumi',         job_title: 'სერვისის თანამშრომელი ბათუმი' },
  { inn: '61006067225', department: 'Batumi',         job_title: 'სერვისის თანამშრომელი ბათუმი' },
  { inn: '37001044420', department: 'Batumi',         job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01105046431', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01391018825', department: 'Batumi',         job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01001011731', department: 'Administration', job_title: 'გაყიდვების კონსულტანტი' },
  { inn: '01030030896', department: 'Administration', job_title: 'ფინანსური დირექტორი' },
  { inn: '62001003104', department: 'Administration', job_title: 'მუშა' },
  { inn: '01027084659', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01011092112', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01019060703', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01027062994', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: 'Z6715307',    department: 'Batumi',         job_title: 'ელექტრო ინჟინერი' },
  { inn: '61010015857', department: 'Batumi',         job_title: 'სამუშაოთა მწარმოებელი' },
  { inn: '01021002449', department: 'Tbilisi',        job_title: 'უსაფრთხოების მენეჯერი' },
  { inn: '45950000727', department: 'Tbilisi',        job_title: 'პროექტის მენეჯერი' },
  { inn: '61006069035', department: 'Batumi',         job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '61006065597', department: 'Batumi',         job_title: 'სერვისის თანამშრომელი ბათუმი' },
  { inn: '61006074146', department: 'Batumi',         job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '61004066717', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '59001067583', department: 'Tbilisi',        job_title: 'ლიფტების და ესკალატორების სერვისის ჯგუფის ინჟინერი' },
  { inn: '61006078821', department: 'Batumi',         job_title: 'სერვისის თანამშრომელი ბათუმი' },
  { inn: '01005032201', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01013008801', department: 'Administration', job_title: 'უსაფრთხოების მენეჯერი' },
  { inn: '61008019270', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01005032263', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01001027557', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '01301111523', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '04001014731', department: 'Administration', job_title: 'მომარაგების მენეჯერი' },
  { inn: '01027080902', department: 'Tbilisi',        job_title: 'გათბობა-კონდიცირების სერვისის თანამშრომელი' },
  { inn: '01006011583', department: 'Administration', job_title: 'სერვის ინჟინერი' },
  { inn: '61008003787', department: 'Batumi',         job_title: 'დასავლეთ საქართველოს რეგიონალური მენეჯერი' },
  { inn: '01026015799', department: 'Tbilisi',        job_title: 'სამუშაოთა მწარმოებელი' },
  { inn: '61001062399', department: 'Batumi',         job_title: 'ბათუმის სერვისის ხელმძღვანელი' },
  { inn: '01030006570', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის ჯგუფის ხელმძღვანელი თბილისი' },
  { inn: '35001059957', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '35001126484', department: 'Tbilisi',        job_title: 'გათბობა-კონდიცირების სერვისის თანამშრომელი' },
  { inn: '01591018889', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '61004008482', department: 'Administration', job_title: 'ბიზნესის განვითარების ხელმძღვანელი' },
  { inn: '61002012718', department: 'Batumi',         job_title: 'საწყობის მენეჯერი' },
  { inn: '01007013161', department: 'Administration', job_title: 'საიტ მენეჯერი' },
  { inn: '18001066909', department: 'Tbilisi',        job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '35001127620', department: 'Administration', job_title: 'დრაფტერი' },
  { inn: '01005041132', department: 'Administration', job_title: 'მძღოლი' },
  { inn: '61006067379', department: 'Batumi',         job_title: 'სერვისის თანამშრომელი ბათუმი' },
  { inn: '01001021886', department: 'Batumi',         job_title: 'გათბობა-კონდიცირების სერვისის თანამშრომელი' },
  { inn: '01024067298', department: 'Administration', job_title: 'დირექტორი' },
  { inn: '62001033449', department: 'Administration', job_title: 'საწყობის მენეჯერი' },
  { inn: '01008045332', department: 'Administration', job_title: 'მთავარი ინჟინერი' },
  { inn: '36001011017', department: 'Batumi',         job_title: 'ლიფტის სერვისის თანამშრომელი' },
  { inn: '10001058207', department: 'Administration', job_title: 'ლოჯისტიკის მენეჯერი' },
];

async function main() {
  let updated = 0;
  let notFound = [];

  for (const emp of employees) {
    // Try exact match, then with leading zero if 10 digits
    const inns = [emp.inn];
    if (/^\d{10}$/.test(emp.inn)) inns.push('0' + emp.inn);

    const rows = await p.$queryRawUnsafe(
      `UPDATE counteragents SET department = $1, job_title = $2, updated_at = NOW()
       WHERE identification_number = ANY($3::text[]) AND is_emploee = true
       RETURNING identification_number`,
      emp.department, emp.job_title, inns
    );

    if (rows.length === 0) {
      notFound.push(emp.inn);
      // Also try without leading zero for checking
      const checkRows = await p.$queryRawUnsafe(
        `SELECT identification_number FROM counteragents WHERE identification_number = ANY($1::text[])`,
        inns
      );
      console.log(`NOT FOUND as employee: ${emp.inn}`, checkRows.length ? '(exists but not is_emploee)' : '(not in DB at all)');
    } else {
      updated += rows.length;
    }
  }

  console.log(`Updated: ${updated}`);
  if (notFound.length > 0) {
    console.log(`Not found (${notFound.length}):`, notFound.join(', '));
  } else {
    console.log('All employees found and updated.');
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
