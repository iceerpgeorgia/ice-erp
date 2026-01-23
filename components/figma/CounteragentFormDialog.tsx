'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/figma/ui/dialog';
import { Button } from '@/components/figma/ui/button';
import { Input } from '@/components/figma/ui/input';
import { Label } from '@/components/figma/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/figma/ui/select';
import { Combobox } from '@/components/ui/combobox';

// Entity Type UUIDs
const EMPLOYEE_UUID = 'bf4d83f9-5064-4958-af6e-e4c21b2e4880';
const FREELANCER_UUID = '5747f8e6-a8a6-4a23-91cc-c427c3a22597';
const SHAREHOLDER_UUID = 'ba538574-e93f-4ce8-a780-667b61fc970a';
const NATURAL_PERSON_UUIDS = [EMPLOYEE_UUID, FREELANCER_UUID, SHAREHOLDER_UUID];

interface FormData {
  name: string;
  identificationNumber: string;
  birthOrIncorporationDate: string;
  entityTypeUuid: string;
  sex: string;
  pensionScheme: string;
  countryUuid: string;
  addressLine1: string;
  addressLine2: string;
  zipCode: string;
  iban: string;
  swift: string;
  director: string;
  directorId: string;
  email: string;
  phone: string;
  orisId: string;
  isActive: boolean;
  isEmploye: boolean;
  wasEmploye: boolean;
}

interface FormErrors {
  [key: string]: string;
}

interface EntityType {
  entityTypeUuid: string;
  entityType: string;
}

interface Country {
  countryUuid: string;
  country: string;
}

interface CounteragentFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  editData?: any;
  entityTypes: EntityType[];
  countries: Country[];
}

export function CounteragentFormDialog({
  isOpen,
  onClose,
  onSave,
  editData,
  entityTypes,
  countries
}: CounteragentFormDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    identificationNumber: '',
    birthOrIncorporationDate: '',
    entityTypeUuid: '',
    sex: '',
    pensionScheme: '',
    countryUuid: '',
    addressLine1: '',
    addressLine2: '',
    zipCode: '',
    iban: '',
    swift: '',
    director: '',
    directorId: '',
    email: '',
    phone: '',
    orisId: '',
    isActive: true,
    isEmploye: false,
    wasEmploye: false,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Load edit data
  useEffect(() => {
    if (editData && isOpen) {
      const formatDateForInput = (dateStr: string | null) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          return date.toISOString().split('T')[0];
        } catch {
          return '';
        }
      };

      setFormData({
        name: editData.name || '',
        identificationNumber: editData.identificationNumber || '',
        birthOrIncorporationDate: formatDateForInput(editData.birthOrIncorporationDate),
        entityTypeUuid: editData.entityTypeUuid || '',
        sex: editData.sex || '',
        pensionScheme: editData.pensionScheme === true ? 'true' : editData.pensionScheme === false ? 'false' : '',
        countryUuid: editData.countryUuid || '',
        addressLine1: editData.addressLine1 || '',
        addressLine2: editData.addressLine2 || '',
        zipCode: editData.zipCode || '',
        iban: editData.iban || '',
        swift: editData.swift || '',
        director: editData.director || '',
        directorId: editData.directorId || '',
        email: editData.email || '',
        phone: editData.phone || '',
        orisId: editData.orisId || '',
        isActive: editData.isActive ?? true,
        isEmploye: editData.isEmploye ?? false,
        wasEmploye: editData.wasEmploye ?? false,
      });
    } else if (!editData && isOpen) {
      // Reset for add
      setFormData({
        name: '',
        identificationNumber: '',
        birthOrIncorporationDate: '',
        entityTypeUuid: '',
        sex: '',
        pensionScheme: '',
        countryUuid: '',
        addressLine1: '',
        addressLine2: '',
        zipCode: '',
        iban: '',
        swift: '',
        director: '',
        directorId: '',
        email: '',
        phone: '',
        orisId: '',
        isActive: true,
        isEmploye: false,
        wasEmploye: false,
      });
    }
    setFormErrors({});
  }, [editData, isOpen]);

  // Validation logic
  const isNaturalPerson = NATURAL_PERSON_UUIDS.includes(formData.entityTypeUuid);
  const isEmployee = formData.entityTypeUuid === EMPLOYEE_UUID;

  const validateForm = () => {
    const errors: FormErrors = {};

    // 1. Name - always mandatory
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    // 2. Entity Type - always mandatory
    if (!formData.entityTypeUuid) {
      errors.entityTypeUuid = 'Entity Type is required';
    }

    // 3. Sex - mandatory for natural persons
    if (isNaturalPerson && !formData.sex) {
      errors.sex = 'Sex is required for natural persons';
    }

    // 4. Pension Scheme - mandatory for employees
    if (isEmployee && !formData.pensionScheme) {
      errors.pensionScheme = 'Pension Scheme is required for employees';
    }

    // 5. Country - always mandatory
    if (!formData.countryUuid) {
      errors.countryUuid = 'Country is required';
    }

    // 6. Email validation (optional but if provided should be valid)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        identification_number: formData.identificationNumber || null,
        birth_or_incorporation_date: formData.birthOrIncorporationDate || null,
        sex: formData.sex || null,
        pension_scheme: formData.pensionScheme === 'true' ? true : formData.pensionScheme === 'false' ? false : null,
        address_line_1: formData.addressLine1 || null,
        address_line_2: formData.addressLine2 || null,
        zip_code: formData.zipCode || null,
        iban: formData.iban || null,
        swift: formData.swift || null,
        director: formData.director || null,
        director_id: formData.directorId || null,
        email: formData.email || null,
        phone: formData.phone || null,
        oris_id: formData.orisId || null,
        country_uuid: formData.countryUuid || null,
        entity_type_uuid: formData.entityTypeUuid || null,
        is_active: formData.isActive,
        is_emploee: formData.isEmploye,
        was_emploee: formData.wasEmploye,
      };

      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Counteragent' : 'Add New Counteragent'}</DialogTitle>
          <DialogDescription>
            {editData ? 'Update counteragent information' : 'Fill in the details to create a new counteragent'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name - Always Required */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <div className="col-span-3">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
            </div>
          </div>

          {/* Entity Type - Always Required */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="entityType" className="text-right">Entity Type *</Label>
            <div className="col-span-3">
              <Combobox
                options={entityTypes.map(et => ({ value: et.entityTypeUuid, label: et.entityType, keywords: et.entityType }))}
                value={formData.entityTypeUuid}
                onValueChange={(value) => updateField('entityTypeUuid', value)}
                placeholder="Select entity type"
                searchPlaceholder="Search entity types..."
                emptyText="No entity type found."
                triggerClassName={formErrors.entityTypeUuid ? 'border-red-500' : ''}
              />
              {formErrors.entityTypeUuid && <p className="text-xs text-red-500 mt-1">{formErrors.entityTypeUuid}</p>}
            </div>
          </div>

          {/* Identification Number */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="idNumber" className="text-right">ID Number</Label>
            <div className="col-span-3">
              <Input
                id="idNumber"
                value={formData.identificationNumber}
                onChange={(e) => updateField('identificationNumber', e.target.value)}
                className={formErrors.identificationNumber ? 'border-red-500' : ''}
              />
              {formErrors.identificationNumber && <p className="text-xs text-red-500 mt-1">{formErrors.identificationNumber}</p>}
            </div>
          </div>

          {/* Birth/Incorporation Date */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="birthDate" className="text-right">Birth/Inc Date</Label>
            <div className="col-span-3">
              <Input
                id="birthDate"
                type="date"
                value={formData.birthOrIncorporationDate}
                onChange={(e) => updateField('birthOrIncorporationDate', e.target.value)}
              />
            </div>
          </div>

          {/* Sex - Required for Natural Persons */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sex" className="text-right">
              Sex {isNaturalPerson ? '*' : ''}
            </Label>
            <div className="col-span-3">
              <Select 
                value={formData.sex} 
                onValueChange={(value) => updateField('sex', value)}
              >
                <SelectTrigger className={formErrors.sex ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.sex && <p className="text-xs text-red-500 mt-1">{formErrors.sex}</p>}
            </div>
          </div>

          {/* Pension Scheme - Required for Employees */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pension" className="text-right">
              Pension Scheme {isEmployee ? '*' : ''}
            </Label>
            <div className="col-span-3">
              <Select 
                value={formData.pensionScheme} 
                onValueChange={(value) => updateField('pensionScheme', value)}
              >
                <SelectTrigger className={formErrors.pensionScheme ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select pension scheme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.pensionScheme && <p className="text-xs text-red-500 mt-1">{formErrors.pensionScheme}</p>}
            </div>
          </div>

          {/* Country - Always Required */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="country" className="text-right">Country *</Label>
            <div className="col-span-3">
              <Combobox
                options={countries.map(c => ({ value: c.countryUuid, label: c.country, keywords: c.country }))}
                value={formData.countryUuid}
                onValueChange={(value) => updateField('countryUuid', value)}
                placeholder="Select country"
                searchPlaceholder="Search countries..."
                emptyText="No country found."
                triggerClassName={formErrors.countryUuid ? 'border-red-500' : ''}
              />
              {formErrors.countryUuid && <p className="text-xs text-red-500 mt-1">{formErrors.countryUuid}</p>}
            </div>
          </div>

          {/* Address Line 1 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="addr1" className="text-right">Address Line 1</Label>
            <div className="col-span-3">
              <Input
                id="addr1"
                value={formData.addressLine1}
                onChange={(e) => updateField('addressLine1', e.target.value)}
              />
            </div>
          </div>

          {/* Address Line 2 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="addr2" className="text-right">Address Line 2</Label>
            <div className="col-span-3">
              <Input
                id="addr2"
                value={formData.addressLine2}
                onChange={(e) => updateField('addressLine2', e.target.value)}
              />
            </div>
          </div>

          {/* Zip Code */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="zip" className="text-right">Zip Code</Label>
            <div className="col-span-3">
              <Input
                id="zip"
                value={formData.zipCode}
                onChange={(e) => updateField('zipCode', e.target.value)}
              />
            </div>
          </div>

          {/* IBAN */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="iban" className="text-right">IBAN</Label>
            <div className="col-span-3">
              <Input
                id="iban"
                value={formData.iban}
                onChange={(e) => updateField('iban', e.target.value)}
              />
            </div>
          </div>

          {/* SWIFT */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="swift" className="text-right">SWIFT</Label>
            <div className="col-span-3">
              <Input
                id="swift"
                value={formData.swift}
                onChange={(e) => updateField('swift', e.target.value)}
              />
            </div>
          </div>

          {/* Director */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="director" className="text-right">Director</Label>
            <div className="col-span-3">
              <Input
                id="director"
                value={formData.director}
                onChange={(e) => updateField('director', e.target.value)}
              />
            </div>
          </div>

          {/* Director ID */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="directorId" className="text-right">Director ID</Label>
            <div className="col-span-3">
              <Input
                id="directorId"
                value={formData.directorId}
                onChange={(e) => updateField('directorId', e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <div className="col-span-3">
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={formErrors.email ? 'border-red-500' : ''}
              />
              {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
            </div>
          </div>

          {/* Phone */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">Phone</Label>
            <div className="col-span-3">
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>
          </div>

          {/* ORIS ID */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="oris" className="text-right">ORIS ID</Label>
            <div className="col-span-3">
              <Input
                id="oris"
                value={formData.orisId}
                onChange={(e) => updateField('orisId', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : editData ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
